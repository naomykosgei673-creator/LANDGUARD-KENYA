import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { hashPassword, verifyPassword } from '../../utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { generateTwoFactorSecret, twoFactorQrDataUrl, verifyTwoFactorToken } from '../../utils/twofa.js';
import { BadRequest, Unauthorized, Forbidden } from '../../utils/errors.js';
import { ALL_ROLES, Roles, UserStatus, permissionsFor } from '../../constants/index.js';
import { audit } from '../../services/audit.service.js';
import { env } from '../../config/env.js';

const router = Router();

const publicUser = (u: any) => ({
  id: u.id, email: u.email, phone: u.phone, firstName: u.firstName, lastName: u.lastName,
  role: u.role, status: u.status, nationalId: u.nationalId, avatarUrl: u.avatarUrl,
  twoFactorEnabled: u.twoFactorEnabled, isBlacklisted: u.isBlacklisted, createdAt: u.createdAt,
  permissions: permissionsFor(u.role),
});

async function issueTokens(user: any) {
  const payload = { sub: user.id, role: user.role, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + env.jwt.refreshTtl * 1000) },
  });
  return { accessToken, refreshToken };
}

// ─── Register ────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email().refine(
    (val) => val.toLowerCase().endsWith('@landguard.co.ke'),
    { message: 'Only @landguard.co.ke email addresses are permitted' },
  ),
  phone: z.string().min(10, 'Phone must be at least 10 digits').max(15),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Needs an uppercase letter').regex(/[0-9]/, 'Needs a number'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  nationalId: z.string().min(6).optional(),
  // Buyers/Sellers can self-register. Privileged roles are provisioned by an admin.
  role: z.enum([Roles.BUYER, Roles.SELLER]).default(Roles.BUYER),
});

router.post('/register', validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof registerSchema>;
  const email = body.email.toLowerCase();

  // Check for existing email or phone to give a clear error
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) throw BadRequest('An account with this email already exists');
  const existingPhone = await prisma.user.findFirst({ where: { phone: body.phone } });
  if (existingPhone) throw BadRequest('An account with this phone number already exists');

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: {
      email, phone: body.phone, passwordHash,
      firstName: body.firstName, lastName: body.lastName, nationalId: body.nationalId,
      role: body.role, status: UserStatus.ACTIVE,
    },
  });
  await audit({ userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id, req });
  const tokens = await issueTokens(user);
  ok(res, { user: publicUser(user), ...tokens }, 201);
}));

// ─── Login ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  twoFactorToken: z.string().optional(),
});

router.post('/login', validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { email, password, twoFactorToken } = req.body as z.infer<typeof loginSchema>;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw Unauthorized('Invalid email or password');
  }
  if (user.status === UserStatus.SUSPENDED) throw Forbidden('Your account has been suspended. Contact support.');

  // Second factor
  if (user.twoFactorEnabled) {
    if (!twoFactorToken) return ok(res, { twoFactorRequired: true });
    if (!user.twoFactorSecret || !verifyTwoFactorToken(user.twoFactorSecret, twoFactorToken)) {
      throw Unauthorized('Invalid 2FA code');
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, req });
  const tokens = await issueTokens(user);
  ok(res, { user: publicUser(user), ...tokens });
}));

// ─── Refresh ─────────────────────────────────────────────────────────────────
router.post('/refresh', validate({ body: z.object({ refreshToken: z.string() }) }), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };
  let payload;
  try { payload = verifyRefreshToken(refreshToken); } catch { throw Unauthorized('Invalid refresh token'); }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revoked || stored.expiresAt < new Date()) throw Unauthorized('Refresh token expired or revoked');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw Unauthorized();

  // Rotate: revoke the old token, issue a fresh pair.
  await prisma.refreshToken.update({ where: { token: refreshToken }, data: { revoked: true } });
  const tokens = await issueTokens(user);
  ok(res, tokens);
}));

// ─── Logout ──────────────────────────────────────────────────────────────────
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) await prisma.refreshToken.updateMany({ where: { token: refreshToken }, data: { revoked: true } });
  ok(res, { message: 'Logged out' });
}));

// ─── Current user ────────────────────────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) throw Unauthorized();
  ok(res, { user: publicUser(user) });
}));

// ─── Two-factor setup / enable / disable ─────────────────────────────────────
router.post('/2fa/setup', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) throw Unauthorized();
  const { base32, otpauthUrl } = generateTwoFactorSecret(user.email);
  // Store provisionally; only flips `enabled` once the user verifies a code.
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: base32 } });
  const qr = await twoFactorQrDataUrl(otpauthUrl);
  ok(res, { secret: base32, qrCode: qr, otpauthUrl });
}));

router.post('/2fa/enable', authenticate, validate({ body: z.object({ token: z.string().length(6) }) }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user?.twoFactorSecret) throw BadRequest('Start 2FA setup first');
  if (!verifyTwoFactorToken(user.twoFactorSecret, req.body.token)) throw BadRequest('Invalid code');
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  await audit({ userId: user.id, action: 'ENABLE_2FA', entity: 'User', entityId: user.id, req });
  ok(res, { message: 'Two-factor authentication enabled' });
}));

router.post('/2fa/disable', authenticate, validate({ body: z.object({ token: z.string().length(6) }) }), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user?.twoFactorSecret) throw BadRequest('2FA is not enabled');
  if (!verifyTwoFactorToken(user.twoFactorSecret, req.body.token)) throw BadRequest('Invalid code');
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  ok(res, { message: 'Two-factor authentication disabled' });
}));

export { router as authRouter, publicUser };
export const knownRoles = ALL_ROLES;
