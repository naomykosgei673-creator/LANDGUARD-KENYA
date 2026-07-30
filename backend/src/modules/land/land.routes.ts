import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok, paginated, parsePagination } from '../../utils/http.js';
import { BadRequest, Forbidden, NotFound } from '../../utils/errors.js';
import { ParcelStatus, VerificationStage, VerificationStatus, Roles } from '../../constants/index.js';
import { audit } from '../../services/audit.service.js';
import { notifyRole } from '../../services/notification.service.js';
import { runAndPersistFraudCheck } from '../../services/fraud.service.js';
import { createParcelQr } from '../../services/qr.service.js';

const router = Router();

const parcelInclude = {
  seller: { select: { id: true, firstName: true, lastName: true, email: true, isBlacklisted: true } },
  currentOwner: { select: { id: true, firstName: true, lastName: true } },
  documents: true,
  _count: { select: { fraudFlags: true, transactions: true } },
};

// ─── Public search / browse (only LISTED + VERIFIED parcels) ─────────────────
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req);
  const where: any = {};

  // Non-privileged viewers only see market-ready listings.
  const role = req.user?.role;
  const privileged = role && [Roles.ADMIN, Roles.GOVERNMENT_OFFICER, Roles.SURVEYOR].includes(role as any);
  if (!privileged) where.status = { in: [ParcelStatus.LISTED, ParcelStatus.VERIFIED, ParcelStatus.UNDER_OFFER] };
  else if (req.query.status) where.status = req.query.status;

  if (req.query.county) where.county = { contains: String(req.query.county) };
  if (req.query.landUse) where.landUse = req.query.landUse;
  if (req.query.minPrice || req.query.maxPrice) {
    where.price = {};
    if (req.query.minPrice) where.price.gte = Number(req.query.minPrice);
    if (req.query.maxPrice) where.price.lte = Number(req.query.maxPrice);
  }
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [
      { parcelNumber: { contains: q } }, { locality: { contains: q } },
      { county: { contains: q } }, { description: { contains: q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.landParcel.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: parcelInclude }),
    prisma.landParcel.count({ where }),
  ]);
  paginated(res, items, total, page, pageSize);
}));

// ─── My parcels (seller) ─────────────────────────────────────────────────────
router.get('/mine', authenticate, asyncHandler(async (req, res) => {
  const items = await prisma.landParcel.findMany({
    where: { sellerId: req.user!.sub },
    orderBy: { createdAt: 'desc' },
    include: parcelInclude,
  });
  ok(res, items);
}));

// ─── Single parcel ───────────────────────────────────────────────────────────
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const parcel = await prisma.landParcel.findUnique({
    where: { id: req.params.id },
    include: {
      ...parcelInclude,
      verifications: { orderBy: { createdAt: 'asc' } },
      fraudFlags: { orderBy: { createdAt: 'desc' } },
      ownershipHistory: { include: { previousOwner: { select: { firstName: true, lastName: true } }, newOwner: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
      qrCodes: true,
    },
  });
  if (!parcel) throw NotFound('Parcel not found');

  // Hide fraud internals from the general public.
  const role = req.user?.role;
  const privileged = role && [Roles.ADMIN, Roles.GOVERNMENT_OFFICER, Roles.SURVEYOR].includes(role as any);
  const isOwnerOrSeller = req.user && (req.user.sub === parcel.sellerId || req.user.sub === parcel.currentOwnerId);
  if (!privileged && !isOwnerOrSeller) {
    (parcel as any).fraudFlags = undefined;
  }
  ok(res, parcel);
}));

// ─── Create parcel (seller) ──────────────────────────────────────────────────
const createSchema = z.object({
  parcelNumber: z.string().min(3),
  titleDeedNumber: z.string().min(3),
  county: z.string().min(2),
  subCounty: z.string().min(2),
  locality: z.string().min(2),
  sizeAcres: z.number().positive(),
  landUse: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL']),
  price: z.number().positive(),
  description: z.string().min(10),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  featuredImage: z.string().optional(),
});
router.post('/', authenticate, requirePermission('parcel:create'), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof createSchema>;
  const parcel = await prisma.landParcel.create({
    data: { ...b, sellerId: req.user!.sub, currentOwnerId: req.user!.sub, status: ParcelStatus.DRAFT },
  });
  await audit({ action: 'CREATE_PARCEL', entity: 'LandParcel', entityId: parcel.id, req });
  ok(res, parcel, 201);
}));

// ─── Update draft (seller owns it, only while editable) ──────────────────────
router.patch('/:id', authenticate, requirePermission('parcel:update:own'), validate({ body: createSchema.partial() }), asyncHandler(async (req, res) => {
  const existing = await prisma.landParcel.findUnique({ where: { id: req.params.id } });
  if (!existing) throw NotFound('Parcel not found');
  if (existing.sellerId !== req.user!.sub) throw Forbidden('You can only edit your own parcels');
  if (![ParcelStatus.DRAFT, ParcelStatus.REJECTED].includes(existing.status as any)) {
    throw BadRequest('Parcel can only be edited while in DRAFT or REJECTED state');
  }
  const parcel = await prisma.landParcel.update({ where: { id: req.params.id }, data: req.body });
  ok(res, parcel);
}));

// ─── Submit for verification (kicks off the workflow + fraud scan) ───────────
router.post('/:id/submit', authenticate, requirePermission('parcel:submit'), asyncHandler(async (req, res) => {
  const parcel = await prisma.landParcel.findUnique({ where: { id: req.params.id }, include: { documents: true } });
  if (!parcel) throw NotFound('Parcel not found');
  if (parcel.sellerId !== req.user!.sub) throw Forbidden('Not your parcel');
  if (![ParcelStatus.DRAFT, ParcelStatus.REJECTED].includes(parcel.status as any)) throw BadRequest('Parcel already submitted');
  const hasTitle = parcel.documents.some((d) => d.type === 'TITLE_DEED');
  if (!hasTitle) throw BadRequest('A TITLE_DEED document is required before submission');

  // Run the fraud engine up-front — high risk blocks the workflow immediately.
  const { riskScore } = await runAndPersistFraudCheck(parcel.id);
  if (riskScore >= 60) {
    await audit({ action: 'SUBMIT_BLOCKED_FRAUD', entity: 'LandParcel', entityId: parcel.id, req, metadata: { riskScore } });
    throw BadRequest(`Submission blocked: fraud risk score ${riskScore}/100. This parcel has been flagged for investigation.`);
  }

  await prisma.$transaction([
    prisma.landParcel.update({ where: { id: parcel.id }, data: { status: ParcelStatus.PENDING_ADMIN } }),
    prisma.verificationRecord.create({ data: { parcelId: parcel.id, stage: VerificationStage.ADMIN_REVIEW, status: VerificationStatus.PENDING } }),
  ]);
  await audit({ action: 'SUBMIT_PARCEL', entity: 'LandParcel', entityId: parcel.id, req });
  await notifyRole(Roles.ADMIN, { title: 'New parcel awaiting review', body: `Parcel ${parcel.parcelNumber} was submitted for verification.`, type: 'INFO', link: '/dashboard/review' });
  ok(res, { message: 'Submitted for verification', riskScore });
}));

// ─── Re-run fraud scan on demand (admin/officer) ─────────────────────────────
router.post('/:id/fraud-scan', authenticate, requirePermission('fraud:read'), asyncHandler(async (req, res) => {
  const result = await runAndPersistFraudCheck(req.params.id);
  await audit({ action: 'FRAUD_SCAN', entity: 'LandParcel', entityId: req.params.id, req, metadata: { riskScore: result.riskScore } });
  ok(res, result);
}));

// ─── Generate a verification QR for a parcel (owner/admin) ────────────────────
router.post('/:id/qr', authenticate, asyncHandler(async (req, res) => {
  const parcel = await prisma.landParcel.findUnique({ where: { id: req.params.id } });
  if (!parcel) throw NotFound('Parcel not found');
  const privileged = [Roles.ADMIN, Roles.GOVERNMENT_OFFICER].includes(req.user!.role as any);
  if (!privileged && parcel.currentOwnerId !== req.user!.sub && parcel.sellerId !== req.user!.sub) {
    throw Forbidden('Only the owner or an official can issue a QR for this parcel');
  }
  const qr = await createParcelQr(parcel.id, 'PARCEL');
  ok(res, qr, 201);
}));

export { router as landRouter };
