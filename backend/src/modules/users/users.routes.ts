import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok, paginated, parsePagination } from '../../utils/http.js';
import { hashPassword } from '../../utils/crypto.js';
import { NotFound } from '../../utils/errors.js';
import { ALL_ROLES, Roles, UserStatus } from '../../constants/index.js';
import { publicUser } from '../auth/auth.routes.js';
import { audit } from '../../services/audit.service.js';
import { notify } from '../../services/notification.service.js';

import { runAndPersistFraudCheck } from '../../services/fraud.service.js';

const router = Router();
router.use(authenticate);

// ─── List users (admin) ──────────────────────────────────────────────────────
router.get('/', requireRole(Roles.ADMIN), asyncHandler(async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req);
  const where: any = {};
  if (req.query.role) where.role = req.query.role;
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }];
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);
  paginated(res, items.map(publicUser), total, page, pageSize);
}));

// ─── Provision a privileged user (admin creates officers/surveyors/admins) ────
const createSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(10),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  role: z.enum(ALL_ROLES as [string, ...string[]]),
  nationalId: z.string().optional(),
});
router.post('/', requireRole(Roles.ADMIN), validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof createSchema>;
  const { password, ...userData } = b;
  const user = await prisma.user.create({
    // Never spread the plaintext password into Prisma data: it is not a database
    // field and would make administrator-created accounts fail at runtime.
    data: { ...userData, email: b.email.toLowerCase(), passwordHash: await hashPassword(password), status: UserStatus.ACTIVE },
  });
  await audit({ action: 'ADMIN_CREATE_USER', entity: 'User', entityId: user.id, req, metadata: { role: b.role } });
  ok(res, publicUser(user), 201);
}));

// ─── Get one ─────────────────────────────────────────────────────────────────
router.get('/:id', requireRole(Roles.ADMIN), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) throw NotFound('User not found');
  ok(res, publicUser(user));
}));

// ─── Update role / status ────────────────────────────────────────────────────
const updateSchema = z.object({
  role: z.enum(ALL_ROLES as [string, ...string[]]).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING]).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});
router.patch('/:id', requireRole(Roles.ADMIN), validate({ body: updateSchema }), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body });
  await audit({ action: 'ADMIN_UPDATE_USER', entity: 'User', entityId: user.id, req, metadata: req.body });
  ok(res, publicUser(user));
}));

// ─── Blacklist / un-blacklist (feeds the fraud engine) ───────────────────────
const blacklistSchema = z.object({ blacklisted: z.boolean(), reason: z.string().optional() });
router.post('/:id/blacklist', requireRole(Roles.ADMIN), validate({ body: blacklistSchema }), asyncHandler(async (req, res) => {
  const { blacklisted, reason } = req.body as z.infer<typeof blacklistSchema>;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { isBlacklisted: blacklisted, blacklistReason: blacklisted ? reason ?? 'Flagged by administrator' : null },
  });

  // Automatically re-scan all parcels by this user so blacklisted listings are immediately flagged
  const sellerParcels = await prisma.landParcel.findMany({ where: { sellerId: user.id } });
  for (const parcel of sellerParcels) {
    await runAndPersistFraudCheck(parcel.id);
  }

  await audit({ action: blacklisted ? 'BLACKLIST_USER' : 'UNBLACKLIST_USER', entity: 'User', entityId: user.id, req, metadata: { reason } });
  await notify({
    userId: user.id,
    title: blacklisted ? 'Account restricted' : 'Account restriction lifted',
    body: blacklisted ? `Your account was restricted: ${reason ?? 'policy violation'}.` : 'Your account is active again.',
    type: blacklisted ? 'WARNING' : 'SUCCESS',
  });
  ok(res, publicUser(user));
}));

export { router as usersRouter };
