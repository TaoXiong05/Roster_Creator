import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const staffRouter = Router();
staffRouter.use(requireAuth);

staffRouter.get('/', async (req: AuthedRequest, res) => {
  const staff = await prisma.staff.findMany({
    where: { userId: req.userId },
    include: { preference: true },
    orderBy: { name: 'asc' },
  });
  res.json(staff);
});

staffRouter.get('/:id', async (req: AuthedRequest, res) => {
  const staff = await prisma.staff.findUnique({
    where: { id: req.params.id },
    include: { preference: true },
  });
  if (!staff || staff.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }
  res.json(staff);
});

staffRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, email, skills } = req.body as { name?: string; email?: string; skills?: string[] };
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  const staff = await prisma.staff.create({
    data: { userId: req.userId!, name, email, skills: skills ?? [] },
  });
  res.status(201).json(staff);
});

staffRouter.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }
  const { name, email, skills } = req.body as { name?: string; email?: string; skills?: string[] };
  const staff = await prisma.staff.update({
    where: { id: req.params.id },
    data: { name, email, skills },
  });
  res.json(staff);
});

staffRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staff.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }
  await prisma.staff.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
