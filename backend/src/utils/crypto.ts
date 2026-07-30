import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// ─── Passwords ───────────────────────────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─── SHA-256 (document fingerprinting for fraud/tamper detection) ─────────────
export function sha256(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ─── HMAC digital signatures (certificates & QR payloads) ────────────────────
export function sign(payload: string): string {
  return crypto.createHmac('sha256', env.jwt.accessSecret).update(payload).digest('hex');
}
export function verifySignature(payload: string, signature: string): boolean {
  const expected = sign(payload);
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
