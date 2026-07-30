import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

interface AuditInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

// Writes an immutable audit-trail entry. Failures never break the request flow.
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? input.req?.user?.sub ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        ipAddress: input.req?.ip ?? null,
        userAgent: input.req?.headers['user-agent'] ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (err) {
    logger.warn('Failed to write audit log', { action: input.action, err: (err as Error).message });
  }
}
