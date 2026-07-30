import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { sign, verifySignature, randomToken } from '../utils/crypto.js';

// A QR code encodes a signed payload so a scan can be verified offline/tamper-proof.
interface QrPayload {
  v: 1;
  type: string;
  code: string;
  parcelId?: string;
  certificateNumber?: string;
  issuedAt: string;
}

export async function createParcelQr(parcelId: string, type = 'PARCEL', extra: Partial<QrPayload> = {}) {
  const code = randomToken(16);
  const payloadObj: QrPayload = { v: 1, type, code, parcelId, issuedAt: new Date().toISOString(), ...extra };
  const raw = JSON.stringify(payloadObj);
  const signature = sign(raw);
  const signedPayload = JSON.stringify({ ...payloadObj, sig: signature });

  const qr = await prisma.qrCode.create({
    data: { code, type, payload: signedPayload, parcelId },
  });
  return qr;
}

export async function renderQrDataUrl(code: string): Promise<string> {
  // The QR image encodes a verification URL the mobile scanner opens.
  const url = `${process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'}/verify/${code}`;
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 1, width: 320 });
}

export async function verifyQr(code: string) {
  const qr = await prisma.qrCode.findUnique({
    where: { code },
    include: {
      parcel: {
        include: {
          currentOwner: { select: { firstName: true, lastName: true } },
          seller: { select: { firstName: true, lastName: true } },
        },
      },
      certificate: true,
    },
  });
  if (!qr) return { valid: false, reason: 'QR code not found in registry' as const };

  // Verify the embedded signature to prove the payload was issued by LandGuard.
  let signatureValid = false;
  try {
    const parsed = JSON.parse(qr.payload);
    const { sig, ...rest } = parsed;
    signatureValid = verifySignature(JSON.stringify(rest), sig);
  } catch {
    signatureValid = false;
  }

  await prisma.qrCode.update({ where: { code }, data: { scans: { increment: 1 } } });

  return {
    valid: signatureValid,
    reason: signatureValid ? null : ('signature mismatch — possible forgery' as const),
    type: qr.type,
    scans: qr.scans + 1,
    parcel: qr.parcel
      ? {
          id: qr.parcel.id,
          parcelNumber: qr.parcel.parcelNumber,
          titleDeedNumber: qr.parcel.titleDeedNumber,
          county: qr.parcel.county,
          locality: qr.parcel.locality,
          sizeAcres: qr.parcel.sizeAcres,
          status: qr.parcel.status,
          currentOwner: qr.parcel.currentOwner
            ? `${qr.parcel.currentOwner.firstName} ${qr.parcel.currentOwner.lastName}`
            : null,
        }
      : null,
    certificate: qr.certificate
      ? { certificateNumber: qr.certificate.certificateNumber, issuedAt: qr.certificate.issuedAt }
      : null,
  };
}
