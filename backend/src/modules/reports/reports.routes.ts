import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { Roles, ParcelStatus, TransactionStatus, PaymentStatus } from '../../constants/index.js';

const router = Router();
router.use(authenticate);

// Role-aware dashboard summary — powers the KPI cards on each dashboard.
router.get('/dashboard', asyncHandler(async (req, res) => {
  const role = req.user!.role;
  const uid = req.user!.sub;

  if (role === Roles.ADMIN || role === Roles.GOVERNMENT_OFFICER) {
    const [users, parcels, listed, flagged, txTotal, completed, pendingApprovals, revenueAgg, fraudOpen] = await Promise.all([
      prisma.user.count(),
      prisma.landParcel.count(),
      prisma.landParcel.count({ where: { status: ParcelStatus.LISTED } }),
      prisma.landParcel.count({ where: { status: ParcelStatus.FLAGGED } }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
      prisma.transaction.count({ where: { status: TransactionStatus.GOV_APPROVAL_PENDING } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: PaymentStatus.SUCCESS } }),
      prisma.fraudFlag.count({ where: { resolved: false } }),
    ]);
    return ok(res, {
      role, users, parcels, listed, flagged, transactions: txTotal, completed,
      pendingApprovals, revenue: revenueAgg._sum.amount ?? 0, openFraudFlags: fraudOpen,
    });
  }

  if (role === Roles.SELLER) {
    const [parcels, listed, underReview, offers, sold] = await Promise.all([
      prisma.landParcel.count({ where: { sellerId: uid } }),
      prisma.landParcel.count({ where: { sellerId: uid, status: ParcelStatus.LISTED } }),
      prisma.landParcel.count({ where: { sellerId: uid, status: { in: [ParcelStatus.PENDING_ADMIN, ParcelStatus.PENDING_GOVERNMENT, ParcelStatus.PENDING_SURVEY] } } }),
      prisma.transaction.count({ where: { sellerId: uid, status: TransactionStatus.OFFER_MADE } }),
      prisma.transaction.count({ where: { sellerId: uid, status: TransactionStatus.COMPLETED } }),
    ]);
    return ok(res, { role, parcels, listed, underReview, pendingOffers: offers, sold });
  }

  if (role === Roles.SURVEYOR) {
    const [queue, visits] = await Promise.all([
      prisma.verificationRecord.count({ where: { stage: 'SURVEY_APPROVAL', status: 'PENDING' } }),
      prisma.siteVisit.count({ where: { surveyorId: uid, status: { in: ['REQUESTED', 'SCHEDULED'] } } }),
    ]);
    return ok(res, { role, surveyQueue: queue, upcomingVisits: visits });
  }

  // BUYER
  const [offers, active, owned] = await Promise.all([
    prisma.transaction.count({ where: { buyerId: uid } }),
    prisma.transaction.count({ where: { buyerId: uid, status: { notIn: [TransactionStatus.COMPLETED, TransactionStatus.REJECTED, TransactionStatus.CANCELLED] } } }),
    prisma.landParcel.count({ where: { currentOwnerId: uid } }),
  ]);
  ok(res, { role, offersMade: offers, activeTransactions: active, parcelsOwned: owned });
}));

// Platform analytics (admin) — parcels by status/county, monthly volume.
router.get('/analytics', requireRole(Roles.ADMIN, Roles.GOVERNMENT_OFFICER), asyncHandler(async (_req, res) => {
  const byStatus = await prisma.landParcel.groupBy({ by: ['status'], _count: true });
  const byCounty = await prisma.landParcel.groupBy({ by: ['county'], _count: true, orderBy: { _count: { county: 'desc' } }, take: 8 });
  const byLandUse = await prisma.landParcel.groupBy({ by: ['landUse'], _count: true });
  ok(res, { byStatus, byCounty, byLandUse });
}));

export { router as reportsRouter };
