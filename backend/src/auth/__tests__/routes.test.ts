import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { hashPassword } from '../password';

const app = createApp();

describe('POST /auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new user and sets a cookie', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com' });

    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com' });
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('rejects duplicate email', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing' });

    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: '123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs in with correct credentials', async () => {
    const passwordHash = await hashPassword('password123');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash });

    const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/token=/);
  });

  it('rejects wrong password', async () => {
    const passwordHash = await hashPassword('password123');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash });

    const res = await request(app).post('/auth/login').send({ email: 'a@b.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const res = await request(app).post('/auth/login').send({ email: 'nope@b.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when not authenticated', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user when authenticated', async () => {
    const passwordHash = await hashPassword('password123');
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', email: 'a@b.com', passwordHash });

    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'a@b.com', password: 'password123' });

    const res = await agent.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com' });
  });
});
