import { Router } from 'express';
import { asyncHandler, ok } from '../../utils/http.js';
import { optionalAuth } from '../../middleware/auth.js';
import { verifyQr, renderQrDataUrl } from '../../services/qr.service.js';
import { audit } from '../../services/audit.service.js';

const router = Router();

// Public verification endpoint — anyone can scan a LandGuard QR to confirm a
// parcel/certificate is genuine. No auth required (that's the point of the feature).
router.get('/verify/:code', optionalAuth, asyncHandler(async (req, res) => {
  const result = await verifyQr(req.params.code);
  await audit({ action: 'QR_VERIFY', entity: 'QrCode', entityId: req.params.code, req, metadata: { valid: result.valid } });
  ok(res, result);
}));

// Render the QR image (PNG data URL) for printing on a certificate.
router.get('/render/:code', asyncHandler(async (req, res) => {
  const dataUrl = await renderQrDataUrl(req.params.code);
  ok(res, { dataUrl });
}));

export { router as qrRouter };
