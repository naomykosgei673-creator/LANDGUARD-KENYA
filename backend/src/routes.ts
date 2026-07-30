import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { landRouter } from './modules/land/land.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { verificationRouter } from './modules/verification/verification.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { messagesRouter } from './modules/messages/messages.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { complaintsRouter } from './modules/complaints/complaints.routes.js';
import { fraudRouter } from './modules/fraud/fraud.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { qrRouter } from './modules/qr/qr.routes.js';

export const api = Router();

api.get('/health', (_req, res) => res.json({ success: true, service: 'landguard-api', status: 'ok', time: new Date().toISOString() }));

api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/parcels', landRouter);
api.use('/documents', documentsRouter);
api.use('/verification', verificationRouter);
api.use('/transactions', transactionsRouter);
api.use('/payments', paymentsRouter);
api.use('/messages', messagesRouter);
api.use('/notifications', notificationsRouter);
api.use('/complaints', complaintsRouter);
api.use('/fraud', fraudRouter);
api.use('/reports', reportsRouter);
api.use('/audit', auditRouter);
api.use('/qr', qrRouter);
