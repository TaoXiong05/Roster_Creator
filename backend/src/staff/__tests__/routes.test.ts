import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staff: {
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

describe('GET /staff', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/staff');
    expect(res.status).toBe(401);
  });

  it('returns staff scoped to the current user', async () => {
    (prisma.staff.findMany as any).mockResolvedValue([
      { id: 'staff-1', userId: 'user-1', name: 'Alice', email: 'alice@b.com', skills: [], preference: null },
    ]);

    const res = await request(app).get('/staff').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /staff/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's staff", async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app).get('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });

  it('returns the staff member with preference', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@b.com',
      skills: [],
      preference: null,
    });

    const res = await request(app).get('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice');
  });
});

describe('POST /staff', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a staff member for the current user', async () => {
    (prisma.staff.create as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@b.com',
      skills: ['cashier'],
    });

    const res = await request(app)
      .post('/staff')
      .set('Cookie', authCookie)
      .send({ name: 'Alice', email: 'alice@b.com', skills: ['cashier'] });

    expect(res.status).toBe(201);
    expect(prisma.staff.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Alice', email: 'alice@b.com', skills: ['cashier'] },
    });
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/staff').set('Cookie', authCookie).send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /staff/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a staff member owned by the current user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.staff.update as any).mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      name: 'Alice B',
      email: 'alice@b.com',
      skills: [],
    });

    const res = await request(app)
      .put('/staff/staff-1')
      .set('Cookie', authCookie)
      .send({ name: 'Alice B', email: 'alice@b.com', skills: [] });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice B');
  });

  it('returns 404 when the staff member belongs to another user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app).put('/staff/staff-1').set('Cookie', authCookie).send({ name: 'Hack' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /staff/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a staff member owned by the current user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'user-1' });
    (prisma.staff.delete as any).mockResolvedValue({ id: 'staff-1' });

    const res = await request(app).delete('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });

  it('returns 404 when the staff member belongs to another user', async () => {
    (prisma.staff.findUnique as any).mockResolvedValue({ id: 'staff-1', userId: 'someone-else' });

    const res = await request(app).delete('/staff/staff-1').set('Cookie', authCookie);

    expect(res.status).toBe(404);
  });
});
