import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { BadRequest, Forbidden, NotFound } from '../../utils/errors.js';
import { ParcelStatus, VerificationStage, VerificationStatus, Roles } from '../../constants/index.js';
import { audit } from '../../services/audit.service.js';
import { notify, notifyRole } from '../../services/notification.service.js';
import { createParcelQr } from '../../services/qr.service.js';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads/docs');
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const router = Router();
router.use(authenticate);

// Ordered pipeline: each approval advances the parcel to the next stage/queue.
const PIPELINE = [
  { stage: VerificationStage.ADMIN_REVIEW, from: ParcelStatus.PENDING_ADMIN, nextStatus: ParcelStatus.PENDING_GOVERNMENT, nextStage: VerificationStage.GOVERNMENT_VERIFICATION, permission: 'verification:government', notifyRole: Roles.GOVERNMENT_OFFICER },
  { stage: VerificationStage.GOVERNMENT_VERIFICATION, from: ParcelStatus.PENDING_GOVERNMENT, nextStatus: ParcelStatus.PENDING_SURVEY, nextStage: VerificationStage.SURVEY_APPROVAL, permission: 'verification:survey', notifyRole: Roles.SURVEYOR },
  { stage: VerificationStage.SURVEY_APPROVAL, from: ParcelStatus.PENDING_SURVEY, nextStatus: ParcelStatus.VERIFIED, nextStage: null, notifyRole: null },
] as const;

// Which single role owns each verification stage. ADMIN can act on any stage
// (holds the '*' permission) as a platform override; every other reviewer is
// locked to their own stage. Buyers/sellers own no stage at all.
const STAGE_ROLE: Record<string, string> = {
  [VerificationStage.ADMIN_REVIEW]: Roles.ADMIN,
  [VerificationStage.GOVERNMENT_VERIFICATION]: Roles.GOVERNMENT_OFFICER,
  [VerificationStage.SURVEY_APPROVAL]: Roles.SURVEYOR,
};
const stageByRole: Record<string, string> = {
  [Roles.ADMIN]: VerificationStage.ADMIN_REVIEW,
  [Roles.GOVERNMENT_OFFICER]: VerificationStage.GOVERNMENT_VERIFICATION,
  [Roles.SURVEYOR]: VerificationStage.SURVEY_APPROVAL,
};

// True when the caller is allowed to action the given stage.
function canActionStage(role: string, stage: string): boolean {
  return role === Roles.ADMIN || STAGE_ROLE[stage] === role;
}

// ─── Verification queue for the caller's stage ───────────────────────────────
router.get('/queue', asyncHandler(async (req, res) => {
  // Only the three reviewer roles have a queue; everyone else is forbidden.
  const ownStage = stageByRole[req.user!.role];
  if (!ownStage) throw Forbidden('No verification queue for your role');
  // Non-admin reviewers may only view their own stage; admins may inspect any.
  const requested = req.query.stage ? String(req.query.stage) : ownStage;
  if (req.user!.role !== Roles.ADMIN && requested !== ownStage) {
    throw Forbidden('You can only view your own verification queue');
  }
  const stage = requested;

  const records = await prisma.verificationRecord.findMany({
    where: { stage, status: VerificationStatus.PENDING },
    include: {
      parcel: {
        include: {
          seller: { select: { firstName: true, lastName: true, email: true, isBlacklisted: true } },
          documents: true,
          _count: { select: { fraudFlags: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  ok(res, records);
}));

// ─── Approve / reject a verification stage ───────────────────────────────────
const decisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']), notes: z.string().optional() });
router.post('/:parcelId/:stage/decision', validate({ body: decisionSchema }), asyncHandler(async (req, res) => {
  const { parcelId, stage } = req.params;
  const { decision, notes } = req.body as z.infer<typeof decisionSchema>;
  const step = PIPELINE.find((s) => s.stage === stage);
  if (!step) throw BadRequest('Unknown verification stage');

  // Role gate per stage. ADMIN_REVIEW must be admin-only — note that SELLER also
  // holds `parcel:submit`, so gating on that permission would let a seller approve
  // the admin review of any parcel. Gate on the stage's owning role instead.
  if (!canActionStage(req.user!.role, stage)) {
    throw Forbidden('You cannot action this verification stage');
  }

  const parcel = await prisma.landParcel.findUnique({ where: { id: parcelId } });
  if (!parcel) throw NotFound('Parcel not found');
  if (parcel.status !== step.from) throw BadRequest(`Parcel is not awaiting ${stage} (current: ${parcel.status})`);

  const record = await prisma.verificationRecord.findFirst({ where: { parcelId, stage, status: VerificationStatus.PENDING } });
  if (!record) throw NotFound('No pending verification record for this stage');

  if (decision === 'REJECT') {
    await prisma.$transaction([
      prisma.verificationRecord.update({ where: { id: record.id }, data: { status: VerificationStatus.REJECTED, reviewerId: req.user!.sub, notes, decidedAt: new Date() } }),
      prisma.landParcel.update({ where: { id: parcelId }, data: { status: ParcelStatus.REJECTED } }),
    ]);
    await audit({ action: `REJECT_${stage}`, entity: 'LandParcel', entityId: parcelId, req, metadata: { notes } });
    await notify({ userId: parcel.sellerId, title: 'Parcel verification rejected', body: `Your parcel ${parcel.parcelNumber} was rejected at ${stage}. ${notes ?? ''}`.trim(), type: 'WARNING', link: `/dashboard/parcels/${parcelId}` });
    return ok(res, { message: 'Parcel rejected', status: ParcelStatus.REJECTED });
  }

  // APPROVE → advance the pipeline.
  const isFinal = step.nextStage === null;
  await prisma.$transaction(async (tx) => {
    await tx.verificationRecord.update({ where: { id: record.id }, data: { status: VerificationStatus.APPROVED, reviewerId: req.user!.sub, notes, decidedAt: new Date() } });
    await tx.landParcel.update({ where: { id: parcelId }, data: { status: step.nextStatus } });
    if (!isFinal) {
      await tx.verificationRecord.create({ data: { parcelId, stage: step.nextStage!, status: VerificationStatus.PENDING } });
    }
  });

  await audit({ action: `APPROVE_${stage}`, entity: 'LandParcel', entityId: parcelId, req });

  if (isFinal) {
    // Fully verified → auto-list, mark all attached documents VERIFIED, and mint verification QR code.
    await prisma.$transaction([
      prisma.landParcel.update({ where: { id: parcelId }, data: { status: ParcelStatus.LISTED } }),
      prisma.document.updateMany({ where: { parcelId }, data: { status: 'VERIFIED' } }),
    ]);

    await createParcelQr(parcelId, 'PARCEL');
    await audit({ action: 'PARCEL_VERIFIED_AND_LISTED', entity: 'LandParcel', entityId: parcelId, req });
    await notify({
      userId: parcel.sellerId,
      title: '✅ Parcel verified & listed',
      body: `Your parcel ${parcel.parcelNumber} passed all verification stages and is now live on the marketplace.`,
      type: 'SUCCESS',
      link: `/dashboard/parcels/${parcelId}`,
    });
  } else if (step.notifyRole) {
    await notifyRole(step.notifyRole, { title: 'Parcel awaiting your review', body: `Parcel ${parcel.parcelNumber} advanced to ${step.nextStage}.`, type: 'INFO', link: '/dashboard/review' });
  }

  ok(res, { message: 'Approved', status: isFinal ? ParcelStatus.LISTED : step.nextStatus });
}));

// ─── Full verification history for a parcel ──────────────────────────────────
router.get('/:parcelId/history', asyncHandler(async (req, res) => {
  // Reviewers see any parcel's history; regular users only their own parcels.
  const isReviewer = Boolean(stageByRole[req.user!.role]);
  if (!isReviewer) {
    const parcel = await prisma.landParcel.findUnique({ where: { id: req.params.parcelId }, select: { sellerId: true, currentOwnerId: true } });
    if (!parcel) throw NotFound('Parcel not found');
    if (parcel.sellerId !== req.user!.sub && parcel.currentOwnerId !== req.user!.sub) {
      throw Forbidden('You can only view verification history for your own parcels');
    }
  }
  const records = await prisma.verificationRecord.findMany({
    where: { parcelId: req.params.parcelId },
    include: { reviewer: { select: { firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  ok(res, records);
}));

export { router as verificationRouter };
