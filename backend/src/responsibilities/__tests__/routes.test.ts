import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    responsibilityTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '../../db';
import { createApp } from '../../app';
import { signToken } from '../../auth/jwt';

const app = createApp();
const authCookie = `token=${signToken({ userId: 'user-1' })}`;

describe('GET /responsibilities', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns responsibilities scoped to the current user', async () => {
    (prisma.responsibilityTemplate.findMany as any).mockResolvedValue([
      { id: 'resp-1', userId: 'user-1', name: 'Cashier' },
    ]);

    const res = await request(app).get('/responsibilities').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.responsibilityTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /responsibilities', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a responsibility', async () => {
    (prisma.responsibilityTemplate.create as any).mockResolvedValue({
      id: 'resp-1',
      userId: 'user-1',
      name: 'Cashier',
    });

    const res = await request(app).post('/responsibilities').set('Cookie', authCookie).send({ name: 'Cashier' });

    expect(res.status).toBe(201);
    expect(prisma.responsibilityTemplate.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Cashier' },
    });
  });

  it('rejects a missing name', async () => {
    const res = await request(app).post('/responsibilities').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });
});

describe('PUT /responsibilities/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's responsibility", async () => {
    (prisma.responsibilityTemplate.findUnique as any).mockResolvedValue({ id: 'resp-1', userId: 'someone-else' });

    const res = await request(app)
      .put('/responsibilities/resp-1')
      .set('Cookie', authCookie)
      .send({ name: 'Hack' });

    expect(res.status).toBe(404);
  });

  it('updates a responsibility owned by the current user', async () => {
    (prisma.responsibilityTemplate.findUnique as any).mockResolvedValue({ id: 'resp-1', userId: 'user-1' });
    (prisma.responsibilityTemplate.update as any).mockResolvedValue({
      id: 'resp-1',
      userId: 'user-1',
      name: 'Head Cashier',
    });

    const res = await request(app)
      .put('/responsibilities/resp-1')
      .set('Cookie', authCookie)
      .send({ name: 'Head Cashier' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Head Cashier');
  });
});

describe('DELETE /responsibilities/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's responsibility", async () => {
    (prisma.responsibilityTemplate.findUnique as any).mockResolvedValue({ id: 'resp-1', userId: 'someone-else' });

    const res = await request(app).delete('/responsibilities/resp-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
    expect(prisma.responsibilityTemplate.delete).not.toHaveBeenCalled();
  });

  it('deletes a responsibility owned by the current user', async () => {
    (prisma.responsibilityTemplate.findUnique as any).mockResolvedValue({ id: 'resp-1', userId: 'user-1' });
    (prisma.responsibilityTemplate.delete as any).mockResolvedValue({ id: 'resp-1' });

    const res = await request(app).delete('/responsibilities/resp-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });
});
