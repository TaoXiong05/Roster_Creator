import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db', () => ({
  prisma: {
    shiftTemplate: {
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

describe('GET /shift-templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns templates scoped to the current user', async () => {
    (prisma.shiftTemplate.findMany as any).mockResolvedValue([
      { id: 'template-1', userId: 'user-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    ]);

    const res = await request(app).get('/shift-templates').set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(prisma.shiftTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /shift-templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a template', async () => {
    (prisma.shiftTemplate.create as any).mockResolvedValue({
      id: 'template-1',
      userId: 'user-1',
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
    });

    const res = await request(app)
      .post('/shift-templates')
      .set('Cookie', authCookie)
      .send({ name: 'Morning', startTime: '06:00', endTime: '14:00' });

    expect(res.status).toBe(201);
    expect(prisma.shiftTemplate.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
    });
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/shift-templates').set('Cookie', authCookie).send({ name: 'Morning' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /shift-templates/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for another user's template", async () => {
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'someone-else' });

    const res = await request(app)
      .put('/shift-templates/template-1')
      .set('Cookie', authCookie)
      .send({ name: 'Hack', startTime: '00:00', endTime: '01:00' });

    expect(res.status).toBe(404);
  });

  it('updates a template owned by the current user', async () => {
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'user-1' });
    (prisma.shiftTemplate.update as any).mockResolvedValue({
      id: 'template-1',
      userId: 'user-1',
      name: 'Morning Shift',
      startTime: '06:00',
      endTime: '14:00',
    });

    const res = await request(app)
      .put('/shift-templates/template-1')
      .set('Cookie', authCookie)
      .send({ name: 'Morning Shift', startTime: '06:00', endTime: '14:00' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Morning Shift');
  });
});

describe('DELETE /shift-templates/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a template owned by the current user', async () => {
    (prisma.shiftTemplate.findUnique as any).mockResolvedValue({ id: 'template-1', userId: 'user-1' });
    (prisma.shiftTemplate.delete as any).mockResolvedValue({ id: 'template-1' });

    const res = await request(app).delete('/shift-templates/template-1').set('Cookie', authCookie);

    expect(res.status).toBe(204);
  });
});
