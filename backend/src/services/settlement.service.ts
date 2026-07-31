import { prisma } from '../lib/prisma.js';
import { TransactionStatus, ParcelStatus } from '../constants/index.js';
import { randomToken, sign } from '../utils/crypto.js';
import { notify } from './notification.service.js';
import { audit } from './audit.service.js';
import { logger } from '../lib/logger.js';

// Called when a payment succeeds. Ownership, certificate, and QR creation must
// either all succeed together or all roll back together.
export async function settleTransaction(transactionId: string) {
  const settled = await prisma.$transaction(async (dbTx) => {
    const tx = await dbTx.transaction.findUnique({
      where: { id: transactionId },
      include: { parcel: true, certificate: true },
    });
    if (!tx) throw new Error('Transaction not found');

    // Payment webhooks may be replayed. Returning the existing certificate makes
    // settlement safe to call more than once without duplicate ownership rows.
    if (tx.status === TransactionStatus.COMPLETED) {
      if (!tx.certificate) throw new Error('Completed transaction is missing its certificate');
      return { certificate: tx.certificate, tx, alreadyCompleted: true };
    }
    if (tx.status !== TransactionStatus.PAID) throw new Error('Transaction is not ready to settle');

    const issuedAt = new Date();
    const certificateNumber = `LG-CERT-${issuedAt.getFullYear()}-${tx.reference.slice(0, 8).toUpperCase()}`;
    const code = randomToken(16);
    const qrBody = {
      v: 1,
      type: 'CERTIFICATE',
      code,
      parcelId: tx.parcelId,
      certificateNumber,
      issuedAt: issuedAt.toISOString(),
    };
    const qr = await dbTx.qrCode.create({
      data: {
        code,
        type: 'CERTIFICATE',
        payload: JSON.stringify({ ...qrBody, sig: sign(JSON.stringify(qrBody)) }),
        parcelId: tx.parcelId,
      },
    });
    const signature = sign(JSON.stringify({
      certNumber: certificateNumber,
      parcelId: tx.parcelId,
      ownerId: tx.buyerId,
      transactionId: tx.id,
      issuedAt: issuedAt.toISOString(),
    }));

    await dbTx.ownershipHistory.create({
      data: {
        parcelId: tx.parcelId,
        previousOwnerId: tx.parcel.currentOwnerId,
        newOwnerId: tx.buyerId,
        transactionId: tx.id,
        transferType: 'SALE',
      },
    });
    await dbTx.landParcel.update({
      where: { id: tx.parcelId },
      data: { currentOwnerId: tx.buyerId, status: ParcelStatus.SOLD },
    });
    await dbTx.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.COMPLETED } });
    const certificate = await dbTx.certificate.create({
      data: {
        certificateNumber,
        parcelId: tx.parcelId,
        ownerId: tx.buyerId,
        transactionId: tx.id,
        signature,
        qrCodeId: qr.id,
      },
    });
    return { certificate, tx, alreadyCompleted: false };
  });

  if (!settled.alreadyCompleted) {
    const { tx, certificate } = settled;
    await audit({ action: 'OWNERSHIP_TRANSFERRED', entity: 'Transaction', entityId: tx.id, metadata: { certNumber: certificate.certificateNumber } });
    await notify({ userId: tx.buyerId, title: 'Ownership transferred', body: `Digital title certificate ${certificate.certificateNumber} has been issued to you.`, type: 'SUCCESS', link: `/dashboard/transactions/${tx.id}` });
    await notify({ userId: tx.sellerId, title: 'Sale completed', body: `The sale of ${tx.parcel.parcelNumber} is complete and ownership has transferred.`, type: 'SUCCESS' });
    logger.info('Transaction settled', { transactionId, certNumber: certificate.certificateNumber });
  }

  return settled.certificate;
}
