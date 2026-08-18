import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

groupsRouter.get('/', async (req: AuthedRequest, res) => {
  const groups = await prisma.staffGroup.findMany({
    where: { userId: req.userId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(groups.map((g) => ({ id: g.id, name: g.name, memberCount: g._count.members })));
});

groupsRouter.post('/', async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const group = await prisma.staffGroup.create({ data: { userId: req.userId!, name } });
  res.status(201).json({ id: group.id, name: group.name, memberCount: 0 });
});

groupsRouter.put('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staffGroup.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Group not found' });
  }
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const group = await prisma.staffGroup.update({ where: { id: req.params.id }, data: { name } });
  res.json({ id: group.id, name: group.name });
});

groupsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const existing = await prisma.staffGroup.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== req.userId) {
    return res.status(404).json({ error: 'Group not found' });
  }
  await prisma.staffGroup.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
