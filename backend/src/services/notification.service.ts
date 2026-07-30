import { prisma } from '../lib/prisma.js';
import { getIo } from '../realtime/io.js';

interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  type?: string;
  link?: string;
}

// Persists a notification and pushes it live over Socket.IO to the user's room.
export async function notify(input: NotifyInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type ?? 'INFO',
      link: input.link,
    },
  });
  try {
    getIo()?.to(`user:${input.userId}`).emit('notification', notification);
  } catch {
    /* realtime optional */
  }
  return notification;
}

export async function notifyRole(role: string, input: Omit<NotifyInput, 'userId'>) {
  const users = await prisma.user.findMany({ where: { role, status: 'ACTIVE' }, select: { id: true } });
  await Promise.all(users.map((u) => notify({ ...input, userId: u.id })));
}
