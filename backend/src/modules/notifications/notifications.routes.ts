import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const items = await prisma.notification.findMany({ where: { userId: req.user!.sub }, orderBy: { createdAt: 'desc' }, take: 50 });
  const unread = await prisma.notification.count({ where: { userId: req.user!.sub, read: false } });
  ok(res, { items, unread });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.sub }, data: { read: true } });
  ok(res, { message: 'Marked as read' });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.sub, read: false }, data: { read: true } });
  ok(res, { message: 'All notifications marked as read' });
}));

export { router as notificationsRouter };
