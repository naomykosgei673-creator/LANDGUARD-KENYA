import { prisma } from '../lib/prisma.js';
import { TransactionStatus, ParcelStatus } from '../constants/index.js';
import { sign } from '../utils/crypto.js';
import { createParcelQr } from './qr.service.js';
import { notify } from './notification.service.js';
import { audit } from './audit.service.js';
import { logger } from '../lib/logger.js';

// Called when a payment for a transaction succeeds. Atomically transfers ownership,
// records history, issues a QR-verifiable digital certificate, and closes the deal.
export async function settleTransaction(transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId }, include: { parcel: true } });
  if (!tx) throw new Error('Transaction not found');
  if (tx.status === TransactionStatus.COMPLETED) return; // idempotent

  const certNumber = `LG-CERT-${new Date().getFullYear()}-${tx.reference.slice(0, 8).toUpperCase()}`;

  await prisma.$transaction(async (dbTx) => {
    // 1. Ownership history (previous → new)
    await dbTx.ownershipHistory.create({
      data: {
        parcelId: tx.parcelId,
        previousOwnerId: tx.parcel.currentOwnerId,
        newOwnerId: tx.buyerId,
        transactionId: tx.id,
        transferType: 'SALE',
      },
    });

    // 2. Transfer the parcel to the buyer and mark it sold
    await dbTx.landParcel.update({
      where: { id: tx.parcelId },
      data: { currentOwnerId: tx.buyerId, status: ParcelStatus.SOLD },
    });

    // 3. Advance the transaction
    await dbTx.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.COMPLETED } });
  });

  // 4. Mint a certificate QR + the signed digital certificate
  const qr = await createParcelQr(tx.parcelId, 'CERTIFICATE', { certificateNumber: certNumber });
  const payload = JSON.stringify({ certNumber, parcelId: tx.parcelId, ownerId: tx.buyerId, transactionId: tx.id, issuedAt: new Date().toISOString() });
  const signature = sign(payload);

  const certificate = await prisma.certificate.create({
    data: {
      certificateNumber: certNumber,
      parcelId: tx.parcelId,
      ownerId: tx.buyerId,
      transactionId: tx.id,
      signature,
      qrCodeId: qr.id,
    },
  });

  await audit({ action: 'OWNERSHIP_TRANSFERRED', entity: 'Transaction', entityId: tx.id, metadata: { certNumber } });
  await notify({ userId: tx.buyerId, title: '🏆 Ownership transferred', body: `Congratulations! Digital title certificate ${certNumber} has been issued to you.`, type: 'SUCCESS', link: `/dashboard/transactions/${tx.id}` });
  await notify({ userId: tx.sellerId, title: 'Sale completed', body: `The sale of ${tx.parcel.parcelNumber} is complete and ownership has transferred.`, type: 'SUCCESS' });
  logger.info('Transaction settled', { transactionId, certNumber });

  return certificate;
}
