import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { NotFound } from '../../utils/errors.js';
import { Roles } from '../../constants/index.js';
import { audit } from '../../services/audit.service.js';
import { notifyRole, notify } from '../../services/notification.service.js';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  subject: z.string().min(3),
  description: z.string().min(10),
  againstUserId: z.string().optional(),
  parcelId: z.string().optional(),
});
router.post('/', validate({ body: createSchema }), asyncHandler(async (req, res) => {
  const complaint = await prisma.complaint.create({ data: { ...req.body, raisedById: req.user!.sub } });
  await audit({ action: 'RAISE_COMPLAINT', entity: 'Complaint', entityId: complaint.id, req });
  await notifyRole(Roles.ADMIN, { title: 'New complaint filed', body: complaint.subject, type: 'WARNING', link: '/dashboard/complaints' });
  ok(res, complaint, 201);
}));

router.get('/', asyncHandler(async (req, res) => {
  const privileged = [Roles.ADMIN, Roles.GOVERNMENT_OFFICER].includes(req.user!.role as any);
  const where = privileged ? (req.query.status ? { status: String(req.query.status) } : {}) : { raisedById: req.user!.sub };
  const items = await prisma.complaint.findMany({
    where,
    include: {
      raisedBy: { select: { firstName: true, lastName: true } },
      againstUser: { select: { firstName: true, lastName: true } },
      parcel: { select: { parcelNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, items);
}));

const resolveSchema = z.object({ status: z.enum(['INVESTIGATING', 'RESOLVED', 'DISMISSED']), resolutionNotes: z.string().optional() });
router.patch('/:id', requireRole(Roles.ADMIN, Roles.GOVERNMENT_OFFICER), validate({ body: resolveSchema }), asyncHandler(async (req, res) => {
  const complaint = await prisma.complaint.findUnique({ where: { id: req.params.id } });
  if (!complaint) throw NotFound('Complaint not found');
  const updated = await prisma.complaint.update({ where: { id: req.params.id }, data: req.body });
  await audit({ action: 'UPDATE_COMPLAINT', entity: 'Complaint', entityId: updated.id, req, metadata: req.body });
  await notify({ userId: complaint.raisedById, title: `Complaint ${req.body.status.toLowerCase()}`, body: `Your complaint "${complaint.subject}" was updated.`, type: 'INFO' });
  ok(res, updated);
}));

export { router as complaintsRouter };
