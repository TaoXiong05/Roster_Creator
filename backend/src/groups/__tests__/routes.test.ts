import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    staffGroup: {
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

describe('GET /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns groups with member counts', async () => {
    (prisma.staffGroup.findMany as any).mockResolvedValue([
      { id: 'group-1', name: 'Kitchen', _count: { members: 3 } },
    ]);

    const res = await request(app).get('/groups').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'group-1', name: 'Kitchen', memberCount: 3 }]);
  });
});

describe('POST /groups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a group', async () => {
    (prisma.staffGroup.create as any).mockResolvedValue({ id: 'group-1', userId: 'user-1', name: 'Kitchen' });

    const res = await request(app).post('/groups').set('Cookie', authCookie).send({ name: 'Kitchen' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'group-1', name: 'Kitchen', memberCount: 0 });
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/groups').set('Cookie', authCookie).send({});
    expect(res.status).toBe(400);
  });
});

describe('PUT /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames a group owned by the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staffGroup.update as any).mockResolvedValue({ id: 'group-1', name: 'Front of House' });

    const res = await request(app).put('/groups/group-1').set('Cookie', authCookie).send({ name: 'Front of House' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Front of House');
  });

  it("returns 404 for another user's group", async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'someone-else' });

    const res = await request(app).put('/groups/group-1').set('Cookie', authCookie).send({ name: 'Hack' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /groups/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a group owned by the current user', async () => {
    (prisma.staffGroup.findUnique as any).mockResolvedValue({ id: 'group-1', userId: 'user-1' });
    (prisma.staffGroup.delete as any).mockResolvedValue({ id: 'group-1' });

    const res = await request(app).delete('/groups/group-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });
});
