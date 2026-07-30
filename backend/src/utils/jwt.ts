import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string; // user id
  role: string;
  email: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshTtl });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
}
