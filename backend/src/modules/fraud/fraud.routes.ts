import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, ok, paginated, parsePagination } from '../../utils/http.js';
import { audit } from '../../services/audit.service.js';
import { ParcelStatus, VerificationStage, VerificationStatus } from '../../constants/index.js';

const router = Router();
router.use(authenticate, requirePermission('fraud:read'));

// All fraud flags (filterable) — the fraud analyst console.
router.get('/', asyncHandler(async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req);
  const where: any = {};
  if (req.query.severity) where.severity = req.query.severity;
  if (req.query.type) where.type = req.query.type;
  if (req.query.resolved) where.resolved = req.query.resolved === 'true';
  const [items, total] = await Promise.all([
    prisma.fraudFlag.findMany({
      where, skip, take, orderBy: [{ resolved: 'asc' }, { score: 'desc' }],
      include: { parcel: { select: { parcelNumber: true, county: true, riskScore: true } }, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.fraudFlag.count({ where }),
  ]);
  paginated(res, items, total, page, pageSize);
}));

// Aggregate stats for the fraud dashboard cards.
router.get('/stats', asyncHandler(async (_req, res) => {
  const [total, unresolved, critical, flaggedParcels] = await Promise.all([
    prisma.fraudFlag.count(),
    prisma.fraudFlag.count({ where: { resolved: false } }),
    prisma.fraudFlag.count({ where: { severity: 'CRITICAL', resolved: false } }),
    prisma.landParcel.count({ where: { status: 'FLAGGED' } }),
  ]);
  const byType = await prisma.fraudFlag.groupBy({ by: ['type'], _count: true });
  ok(res, { total, unresolved, critical, flaggedParcels, byType });
}));

router.post('/:id/resolve', asyncHandler(async (req, res) => {
  const flag = await prisma.fraudFlag.update({ where: { id: req.params.id }, data: { resolved: true } });

  // If this flag belonged to a parcel, re-assess remaining unresolved flags & risk score
  if (flag.parcelId) {
    const activeFlags = await prisma.fraudFlag.findMany({
      where: { parcelId: flag.parcelId, resolved: false },
    });
    const newRiskScore = Math.min(100, activeFlags.reduce((sum, f) => sum + f.score, 0));
    const parcel = await prisma.landParcel.findUnique({ where: { id: flag.parcelId } });

    if (parcel) {
      const shouldUnflag = parcel.status === 'FLAGGED' && newRiskScore < 60;
      let restoredStatus: string | undefined;
      if (shouldUnflag) {
        // FLAGGED replaces the visible lifecycle state, so reconstruct the
        // correct state from its verification history. Never publish a draft
        // merely because an administrator resolved a fraud flag.
        const records = await prisma.verificationRecord.findMany({ where: { parcelId: flag.parcelId } });
        const pending = records.find((record) => record.status === VerificationStatus.PENDING);
        const rejected = records.some((record) => record.status === VerificationStatus.REJECTED);
        const stageStatus: Record<string, string> = {
          [VerificationStage.ADMIN_REVIEW]: ParcelStatus.PENDING_ADMIN,
          [VerificationStage.GOVERNMENT_VERIFICATION]: ParcelStatus.PENDING_GOVERNMENT,
          [VerificationStage.SURVEY_APPROVAL]: ParcelStatus.PENDING_SURVEY,
        };
        restoredStatus = pending
          ? stageStatus[pending.stage]
          : rejected
            ? ParcelStatus.REJECTED
            : records.length >= 3
              ? ParcelStatus.LISTED
              : ParcelStatus.DRAFT;
      }
      await prisma.landParcel.update({
        where: { id: flag.parcelId },
        data: {
          riskScore: newRiskScore,
          ...(restoredStatus ? { status: restoredStatus } : {}),
        },
      });
    }
  }

  await audit({ action: 'RESOLVE_FRAUD_FLAG', entity: 'FraudFlag', entityId: flag.id, req });
  ok(res, flag);
}));

export { router as fraudRouter };
