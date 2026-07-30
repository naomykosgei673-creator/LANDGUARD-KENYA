import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { getIo } from '../../realtime/io.js';

const router = Router();
router.use(authenticate);

// Conversation list — most recent message per counterparty.
router.get('/threads', asyncHandler(async (req, res) => {
  const uid = req.user!.sub;
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: uid }, { receiverId: uid }] },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
      receiver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const threads = new Map<string, any>();
  for (const m of messages) {
    const other = m.senderId === uid ? m.receiver : m.sender;
    if (!threads.has(other.id)) threads.set(other.id, { user: other, lastMessage: m, unread: 0 });
    if (m.receiverId === uid && !m.read) threads.get(other.id).unread += 1;
  }
  ok(res, Array.from(threads.values()));
}));

// Full conversation with a specific user (marks incoming as read).
router.get('/with/:userId', asyncHandler(async (req, res) => {
  const uid = req.user!.sub;
  const other = req.params.userId;
  const messages = await prisma.message.findMany({
    where: { OR: [{ senderId: uid, receiverId: other }, { senderId: other, receiverId: uid }] },
    orderBy: { createdAt: 'asc' },
  });
  await prisma.message.updateMany({ where: { senderId: other, receiverId: uid, read: false }, data: { read: true } });
  ok(res, messages);
}));

const sendSchema = z.object({ receiverId: z.string(), content: z.string().min(1).max(2000), parcelId: z.string().optional() });
router.post('/', validate({ body: sendSchema }), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof sendSchema>;
  const message = await prisma.message.create({ data: { ...b, senderId: req.user!.sub } });
  getIo()?.to(`user:${b.receiverId}`).emit('message:new', message);
  ok(res, message, 201);
}));

export { router as messagesRouter };
