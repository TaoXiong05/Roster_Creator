import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { makeLimiter, keyByUserOrIp } from '../rateLimit';
import { signToken } from '../auth/jwt';

function buildApp(max: number) {
  const app = express();
  app.use(cookieParser());
  app.use(makeLimiter(max));
  app.get('/probe', (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('keyByUserOrIp', () => {
  it('keys by ip when there is no auth cookie', () => {
    const req = { cookies: {}, ip: '203.0.113.5' } as any;
    expect(keyByUserOrIp(req)).toBe('ip:203.0.113.5');
  });

  it('keys by ip when the cookie is an invalid token', () => {
    const req = { cookies: { token: 'not-a-real-token' }, ip: '203.0.113.5' } as any;
    expect(keyByUserOrIp(req)).toBe('ip:203.0.113.5');
  });

  it('keys by user id when the cookie is a valid token', () => {
    const token = signToken({ userId: 'user-42' });
    const req = { cookies: { token }, ip: '203.0.113.5' } as any;
    expect(keyByUserOrIp(req)).toBe('user:user-42');
  });
});

describe('rate limit enforcement', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('is skipped when NODE_ENV is test, even past the cap', async () => {
    process.env.NODE_ENV = 'test';
    const app = buildApp(2);

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/probe');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 with the standard error shape once the cap is exceeded', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp(2);

    expect((await request(app).get('/probe')).status).toBe(200);
    expect((await request(app).get('/probe')).status).toBe(200);

    const res = await request(app).get('/probe');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests, please try again later.' });
  });

  it('gives independent budgets to different authenticated users', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp(1);
    const tokenA = signToken({ userId: 'user-a' });
    const tokenB = signToken({ userId: 'user-b' });

    expect((await request(app).get('/probe').set('Cookie', `token=${tokenA}`)).status).toBe(200);
    expect((await request(app).get('/probe').set('Cookie', `token=${tokenA}`)).status).toBe(429);

    // A different user's budget is untouched by user-a's requests.
    expect((await request(app).get('/probe').set('Cookie', `token=${tokenB}`)).status).toBe(200);
  });
});
