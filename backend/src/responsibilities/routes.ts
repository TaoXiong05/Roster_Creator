import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { findOwnedOrThrow, withNotFoundHandling } from '../routeHelpers';

export const responsibilityRouter = Router();
responsibilityRouter.use(requireAuth);

responsibilityRouter.get('/', async (req: AuthedRequest, res) => {
  const responsibilities = await prisma.responsibilityTemplate.findMany({
    where: { userId: req.userId },
    orderBy: { name: 'asc' },
  });
  res.json(responsibilities);
});

responsibilityRouter.post('/', async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const responsibility = await prisma.responsibilityTemplate.create({
    data: { userId: req.userId!, name },
  });
  res.status(201).json(responsibility);
});

responsibilityRouter.put(
  '/:id',
  withNotFoundHandling(async (req: AuthedRequest, res) => {
    await findOwnedOrThrow(
      () => prisma.responsibilityTemplate.findUnique({ where: { id: req.params.id } }),
      req.userId,
      'Responsibility not found'
    );
    const { name } = req.body as { name?: string };
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const responsibility = await prisma.responsibilityTemplate.update({
      where: { id: req.params.id },
      data: { name },
    });
    res.json(responsibility);
  })
);

responsibilityRouter.delete(
  '/:id',
  withNotFoundHandling(async (req: AuthedRequest, res) => {
    await findOwnedOrThrow(
      () => prisma.responsibilityTemplate.findUnique({ where: { id: req.params.id } }),
      req.userId,
      'Responsibility not found'
    );
    await prisma.responsibilityTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
