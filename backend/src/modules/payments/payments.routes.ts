import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { BadRequest, Forbidden, NotFound } from '../../utils/errors.js';
import { PaymentMethod, PaymentStatus, Roles, TransactionStatus } from '../../constants/index.js';
import { getGateway } from '../../services/payment/gateway.js';
import { settleTransaction } from '../../services/settlement.service.js';
import { audit } from '../../services/audit.service.js';
import { env } from '../../config/env.js';

const router = Router();

// ─── Initiate a payment for an approved transaction (buyer) ──────────────────
const initiateSchema = z.object({
  transactionId: z.string(),
  method: z.enum(Object.values(PaymentMethod) as [string, ...string[]]),
  phoneNumber: z.string().optional(),
});
router.post('/', authenticate, requirePermission('payment:create'), validate({ body: initiateSchema }), asyncHandler(async (req, res) => {
  const { transactionId, method, phoneNumber } = req.body as z.infer<typeof initiateSchema>;
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw NotFound('Transaction not found');
  if (tx.buyerId !== req.user!.sub) throw Forbidden('Only the buyer can pay for this transaction');
  if (tx.status !== TransactionStatus.PAYMENT_PENDING) throw BadRequest('Transaction is not ready for payment (needs government approval first)');
  if (method === PaymentMethod.MPESA && !phoneNumber) throw BadRequest('phoneNumber is required for M-Pesa');

  const payment = await prisma.payment.create({
    data: { transactionId, amount: tx.offerAmount, method, phoneNumber, status: PaymentStatus.PENDING },
  });

  const gateway = getGateway(method);
  const result = await gateway.charge({
    amount: tx.offerAmount, currency: 'KES', method, reference: payment.reference, phoneNumber,
  });

  const newStatus = result.status === 'SUCCESS' ? PaymentStatus.SUCCESS : result.status === 'FAILED' ? PaymentStatus.FAILED : PaymentStatus.PENDING;
  await prisma.payment.update({ where: { id: payment.id }, data: { status: newStatus, providerRef: result.providerRef, failureReason: result.status === 'FAILED' ? result.message : null } });
  await audit({ action: 'INITIATE_PAYMENT', entity: 'Payment', entityId: payment.id, req, metadata: { method, amount: tx.offerAmount } });

  // Card/sandbox settles instantly; M-Pesa/bank settle via callback/webhook.
  if (newStatus === PaymentStatus.SUCCESS) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.PAID } });
    await settleTransaction(tx.id);
  }

  ok(res, { payment: { id: payment.id, reference: payment.reference, status: newStatus }, providerMessage: result.message }, 201);
}));

// ─── Payment status (buyer polls M-Pesa/bank) ────────────────────────────────
router.get('/:reference', authenticate, asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { reference: req.params.reference }, include: { transaction: true } });
  if (!payment) throw NotFound('Payment not found');
  const privileged = [Roles.ADMIN, Roles.GOVERNMENT_OFFICER].includes(req.user!.role as any);
  if (!privileged && payment.transaction.buyerId !== req.user!.sub && payment.transaction.sellerId !== req.user!.sub) {
    throw Forbidden('You cannot view this payment');
  }
  ok(res, payment);
}));

// ─── M-Pesa STK callback (public — Safaricom → us) ───────────────────────────
// In production, verify the source IP / checksum. Sandbox accepts a simple body.
router.post('/mpesa/callback', asyncHandler(async (req, res) => {
  const reference = req.body?.reference ?? req.body?.Body?.stkCallback?.MerchantRequestID;
  const success = req.body?.success ?? req.body?.Body?.stkCallback?.ResultCode === 0;
  if (!reference) return res.json({ ResultCode: 0, ResultDesc: 'Ignored' });

  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (payment && payment.status === PaymentStatus.PENDING) {
    if (success) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCESS } });
      await prisma.transaction.update({ where: { id: payment.transactionId }, data: { status: TransactionStatus.PAID } });
      await settleTransaction(payment.transactionId);
    } else {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, failureReason: 'M-Pesa payment cancelled/failed' } });
    }
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}));

// ─── Manual settle for sandbox demo (buyer confirms a PENDING M-Pesa/bank pay) ─
router.post('/:reference/confirm-sandbox', authenticate, asyncHandler(async (req, res) => {
  if (!env.payments.sandbox) throw Forbidden('Sandbox payment confirmation is disabled');
  const payment = await prisma.payment.findUnique({ where: { reference: req.params.reference }, include: { transaction: true } });
  if (!payment) throw NotFound('Payment not found');
  if (payment.transaction.buyerId !== req.user!.sub) throw Forbidden();
  if (payment.status !== PaymentStatus.PENDING) throw BadRequest('Payment already finalised');
  await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCESS } });
  await prisma.transaction.update({ where: { id: payment.transactionId }, data: { status: TransactionStatus.PAID } });
  const cert = await settleTransaction(payment.transactionId);
  ok(res, { message: 'Payment confirmed and ownership transferred', certificate: cert });
}));

export { router as paymentsRouter };
