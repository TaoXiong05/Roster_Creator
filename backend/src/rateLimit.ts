import rateLimit, { Options, ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { verifyToken } from './auth/jwt';

const WINDOW_MS = 15 * 60 * 1000;

// Keys by the authenticated user when the request carries a valid token (so a shared account,
// e.g. the demo login, is throttled per-account rather than per-IP) and falls back to IP
// otherwise (pre-login requests like /auth/login attempts). IPv6 addresses are normalized to
// their /64 prefix via ipKeyGenerator so an attacker can't dodge the limit by rotating through
// addresses in the same block.
export function keyByUserOrIp(req: Request): string {
  const token = req.cookies?.token;
  const payload = token ? verifyToken(token) : null;
  return payload ? `user:${payload.userId}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

export function makeLimiter(max: number, overrides: Partial<Options> = {}) {
  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json({ error: 'Too many requests, please try again later.' });
    },
    ...overrides,
  });
}

// Brute-force-prone auth endpoints (register/login/demo/password-reset).
export const authLimiter = makeLimiter(20);

// General baseline across the whole API.
export const apiLimiter = makeLimiter(300);

// Costly, spammable actions: sending emails and generating exports.
export const heavyActionLimiter = makeLimiter(10);
