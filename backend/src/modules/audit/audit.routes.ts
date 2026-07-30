import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { asyncHandler, paginated, parsePagination } from '../../utils/http.js';

const router = Router();
router.use(authenticate, requirePermission('audit:read'));

// Immutable audit trail viewer (admin/officer). Filter by entity/action/user.
router.get('/', asyncHandler(async (req, res) => {
  const { skip, take, page, pageSize } = parsePagination(req);
  const where: any = {};
  if (req.query.entity) where.entity = req.query.entity;
  if (req.query.action) where.action = { contains: String(req.query.action) };
  if (req.query.userId) where.userId = req.query.userId;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip, take, orderBy: { createdAt: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  paginated(res, items, total, page, pageSize);
}));

export { router as auditRouter };
