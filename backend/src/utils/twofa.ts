import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

// Time-based One-Time Password (TOTP) — compatible with Google Authenticator / Authy.
export function generateTwoFactorSecret(email: string) {
  const secret = speakeasy.generateSecret({
    name: `${env.jwt.twoFactorIssuer} (${email})`,
    issuer: env.jwt.twoFactorIssuer,
    length: 20,
  });
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url ?? '' };
}

export async function twoFactorQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTwoFactorToken(secretBase32: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token,
    window: 1, // tolerate ±30s clock drift
  });
}
