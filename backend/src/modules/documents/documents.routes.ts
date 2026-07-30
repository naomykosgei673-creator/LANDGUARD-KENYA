import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { sha256 } from '../../utils/crypto.js';
import { BadRequest, Forbidden, NotFound } from '../../utils/errors.js';
import { DocumentType, DocumentStatus } from '../../constants/index.js';
import { audit } from '../../services/audit.service.js';
import { runAndPersistFraudCheck } from '../../services/fraud.service.js';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// More reliable pathing using project root
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads/docs');

// Ensure directory exists immediately on module load
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const router = Router();
router.use(authenticate);

// Upload records document metadata. The actual binary lives in Firebase Storage
// (or the local dev driver); here we persist the storage URL plus a SHA-256
// fingerprint used for duplicate/tamper fraud detection. If raw base64 content is
// supplied (dev/demo), the hash is derived from it; otherwise the client sends the
// hash it computed at upload time.
const uploadSchema = z.object({
  parcelId: z.string(),
  type: z.enum(Object.values(DocumentType) as [string, ...string[]]),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  mimeType: z.string().default('application/pdf'),
  contentBase64: z.string().optional(),
  fileHash: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
});

router.post('/', requirePermission('document:upload'), validate({ body: uploadSchema }), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof uploadSchema>;
  const parcel = await prisma.landParcel.findUnique({ where: { id: b.parcelId } });
  if (!parcel) throw NotFound('Parcel not found');
  if (parcel.sellerId !== req.user!.sub) throw Forbidden('You can only attach documents to your own parcel');

  const fileId = `${Date.now()}-${b.fileName}`;
  const filePath = path.join(UPLOADS_DIR, fileId);

  if (b.contentBase64) {
    await fs.writeFile(filePath, Buffer.from(b.contentBase64, 'base64'));
  }

  const fileHash = b.contentBase64 ? sha256(b.contentBase64) : (b.fileHash ?? sha256(`${b.fileName}:${b.fileUrl}`));

  const doc = await prisma.document.create({
    data: {
      parcelId: b.parcelId, type: b.type, fileName: b.fileName, fileUrl: fileId,
      mimeType: b.mimeType, fileHash, expiryDate: b.expiryDate, uploadedById: req.user!.sub,
    },
  });
  await audit({ action: 'UPLOAD_DOCUMENT', entity: 'Document', entityId: doc.id, req, metadata: { type: b.type } });
  await runAndPersistFraudCheck(b.parcelId);
  ok(res, doc, 201);
}));

router.get('/:id/content', requirePermission('document:read'), asyncHandler(async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) throw NotFound('Document not found');

  let contentBase64 = null;
  try {
    const filePath = path.join(UPLOADS_DIR, doc.fileUrl);
    const buffer = await fs.readFile(filePath);
    contentBase64 = buffer.toString('base64');
  } catch (err) {
    // If file doesn't exist (seeded data), we'll return null and frontend handles fallback
  }

  ok(res, {
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    contentBase64
  });
}));

router.get('/parcel/:parcelId', asyncHandler(async (req, res) => {
  const docs = await prisma.document.findMany({ where: { parcelId: req.params.parcelId }, orderBy: { createdAt: 'asc' } });
  ok(res, docs);
}));

// Officer / surveyor verifies or rejects an individual document.
const decisionSchema = z.object({ decision: z.enum(['VERIFIED', 'REJECTED']), reason: z.string().optional() });
router.post('/:id/decision', requirePermission('document:verify'), validate({ body: decisionSchema }), asyncHandler(async (req, res) => {
  const { decision, reason } = req.body as z.infer<typeof decisionSchema>;
  if (decision === 'REJECTED' && !reason) throw BadRequest('A reason is required to reject a document');
  const doc = await prisma.document.update({
    where: { id: req.params.id },
    data: {
      status: decision === 'VERIFIED' ? DocumentStatus.VERIFIED : DocumentStatus.REJECTED,
      verifiedById: req.user!.sub,
      rejectionReason: decision === 'REJECTED' ? reason : null,
    },
  });
  await audit({ action: `DOCUMENT_${decision}`, entity: 'Document', entityId: doc.id, req });
  ok(res, doc);
}));

export { router as documentsRouter };
