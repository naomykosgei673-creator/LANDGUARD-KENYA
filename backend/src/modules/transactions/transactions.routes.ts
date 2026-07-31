import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { BadRequest, Forbidden, NotFound } from '../../utils/errors.js';
import { ParcelStatus, TransactionStatus, Roles } from '../../constants/index.js';
import { audit } from '../../services/audit.service.js';
import { notify, notifyRole } from '../../services/notification.service.js';

const router = Router();
router.use(authenticate);

const txInclude = {
  parcel: { select: { id: true, parcelNumber: true, county: true, locality: true, price: true, featuredImage: true } },
  buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
  seller: { select: { id: true, firstName: true, lastName: true, email: true } },
  payments: true,
};

// ─── List my transactions (buyer, seller) or all (admin/officer) ─────────────
router.get('/', asyncHandler(async (req, res) => {
  const role = req.user!.role;
  const uid = req.user!.sub;
  let where: any = {};
  if (role === Roles.BUYER) where = { buyerId: uid };
  else if (role === Roles.SELLER) where = { sellerId: uid };
  else if (role === Roles.GOVERNMENT_OFFICER && req.query.pending === 'true') where = { status: TransactionStatus.GOV_APPROVAL_PENDING };
  const items = await prisma.transaction.findMany({ where, include: txInclude, orderBy: { createdAt: 'desc' } });
  ok(res, items);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const tx = await prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: {
      ...txInclude,
      certificate: {
        include: {
          qrCode: true,
          owner: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!tx) throw NotFound('Transaction not found');
  const uid = req.user!.sub;
  const privileged = [Roles.ADMIN, Roles.GOVERNMENT_OFFICER].includes(req.user!.role as any);
  if (!privileged && tx.buyerId !== uid && tx.sellerId !== uid) throw Forbidden();
  ok(res, tx);
}));

// ─── Buyer makes an offer ────────────────────────────────────────────────────
const offerSchema = z.object({ parcelId: z.string(), offerAmount: z.number().positive() });
router.post('/', requirePermission('transaction:create'), validate({ body: offerSchema }), asyncHandler(async (req, res) => {
  const { parcelId, offerAmount } = req.body as z.infer<typeof offerSchema>;
  const parcel = await prisma.landParcel.findUnique({ where: { id: parcelId } });
  if (!parcel) throw NotFound('Parcel not found');
  if (![ParcelStatus.LISTED, ParcelStatus.VERIFIED].includes(parcel.status as any)) throw BadRequest('This parcel is not available for offers');
  if (parcel.sellerId === req.user!.sub) throw BadRequest('You cannot make an offer on your own parcel');

  // Reserve the listing and create the offer in one transaction. The conditional
  // update prevents two buyers from creating competing offers from a stale page.
  const tx = await prisma.$transaction(async (dbTx) => {
    const reserved = await dbTx.landParcel.updateMany({
      where: { id: parcelId, status: { in: [ParcelStatus.LISTED, ParcelStatus.VERIFIED] } },
      data: { status: ParcelStatus.UNDER_OFFER },
    });
    if (reserved.count !== 1) throw BadRequest('This parcel is no longer available for offers');
    return dbTx.transaction.create({
      data: { parcelId, buyerId: req.user!.sub, sellerId: parcel.sellerId, offerAmount, status: TransactionStatus.OFFER_MADE },
    });
  });
  await audit({ action: 'MAKE_OFFER', entity: 'Transaction', entityId: tx.id, req, metadata: { offerAmount } });
  await notify({ userId: parcel.sellerId, title: 'New offer received', body: `You received an offer of KES ${offerAmount.toLocaleString()} on ${parcel.parcelNumber}.`, type: 'TRANSACTION', link: `/dashboard/transactions/${tx.id}` });
  ok(res, tx, 201);
}));

// ─── Seller accepts / rejects an offer ───────────────────────────────────────
const respondSchema = z.object({ decision: z.enum(['ACCEPT', 'REJECT']) });
router.post('/:id/respond', requirePermission('transaction:respond'), validate({ body: respondSchema }), asyncHandler(async (req, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { parcel: true } });
  if (!tx) throw NotFound('Transaction not found');
  if (tx.sellerId !== req.user!.sub) throw Forbidden('Only the seller can respond to this offer');
  if (tx.status !== TransactionStatus.OFFER_MADE) throw BadRequest('This offer has already been actioned');

  if (req.body.decision === 'REJECT') {
    await prisma.$transaction([
      prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.REJECTED } }),
      prisma.landParcel.update({ where: { id: tx.parcelId }, data: { status: ParcelStatus.LISTED } }),
    ]);
    await notify({ userId: tx.buyerId, title: 'Offer declined', body: `Your offer on ${tx.parcel.parcelNumber} was declined.`, type: 'WARNING', link: `/dashboard/transactions/${tx.id}` });
    return ok(res, { message: 'Offer rejected' });
  }

  // Accept → route to government approval before any money moves.
  await prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.GOV_APPROVAL_PENDING } });
  await audit({ action: 'ACCEPT_OFFER', entity: 'Transaction', entityId: tx.id, req });
  await notify({ userId: tx.buyerId, title: 'Offer accepted 🎉', body: `The seller accepted your offer on ${tx.parcel.parcelNumber}. Awaiting government approval.`, type: 'SUCCESS', link: `/dashboard/transactions/${tx.id}` });
  await notifyRole(Roles.GOVERNMENT_OFFICER, { title: 'Transfer awaiting approval', body: `A sale of ${tx.parcel.parcelNumber} needs government approval.`, type: 'INFO', link: '/dashboard/approvals' });
  ok(res, { message: 'Offer accepted — sent for government approval' });
}));

// ─── Government officer approves the transfer ────────────────────────────────
router.post('/:id/gov-approve', requirePermission('transaction:approve'), validate({ body: z.object({ approve: z.boolean(), notes: z.string().optional() }) }), asyncHandler(async (req, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { parcel: true } });
  if (!tx) throw NotFound('Transaction not found');
  if (tx.status !== TransactionStatus.GOV_APPROVAL_PENDING) throw BadRequest('Transaction is not awaiting government approval');

  if (!req.body.approve) {
    await prisma.$transaction([
      prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.CANCELLED, govApprovedById: req.user!.sub, notes: req.body.notes } }),
      prisma.landParcel.update({ where: { id: tx.parcelId }, data: { status: ParcelStatus.LISTED } }),
    ]);
    await notify({ userId: tx.buyerId, title: 'Transfer not approved', body: `Government approval was declined for ${tx.parcel.parcelNumber}.`, type: 'WARNING' });
    return ok(res, { message: 'Transfer rejected by government' });
  }

  await prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.PAYMENT_PENDING, govApprovedById: req.user!.sub, notes: req.body.notes } });
  await audit({ action: 'GOV_APPROVE_TRANSFER', entity: 'Transaction', entityId: tx.id, req });
  await notify({ userId: tx.buyerId, title: '✅ Government approved — proceed to payment', body: `The transfer of ${tx.parcel.parcelNumber} is approved. Complete payment to finalise ownership.`, type: 'SUCCESS', link: `/dashboard/transactions/${tx.id}` });
  ok(res, { message: 'Approved — buyer may now pay' });
}));

export { router as transactionsRouter };
