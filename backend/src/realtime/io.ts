import { Server as SocketServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

let io: SocketServer | null = null;

export function initIo(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  // Authenticate sockets via JWT and join a per-user room for targeted pushes.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      (socket.data as any).user = payload;
      socket.join(`user:${payload.sub}`);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket.data as any).user;
    logger.debug('Socket connected', { userId: user?.sub });

    // Live 1:1 chat — relay to the recipient's room; persistence handled by REST.
    socket.on('message:send', (payload: { receiverId: string; content: string; parcelId?: string }) => {
      io?.to(`user:${payload.receiverId}`).emit('message:new', {
        ...payload,
        senderId: user.sub,
        createdAt: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => logger.debug('Socket disconnected', { userId: user?.sub }));
  });

  return io;
}

export function getIo(): SocketServer | null {
  return io;
}
