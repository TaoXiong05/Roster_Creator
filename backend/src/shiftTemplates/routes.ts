import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { findOwnedOrThrow, withNotFoundHandling } from '../routeHelpers';

export const shiftTemplateRouter = Router();
shiftTemplateRouter.use(requireAuth);

shiftTemplateRouter.get('/', async (req: AuthedRequest, res) => {
  const templates = await prisma.shiftTemplate.findMany({
    where: { userId: req.userId },
    orderBy: { startTime: 'asc' },
  });
  res.json(templates);
});

shiftTemplateRouter.post('/', async (req: AuthedRequest, res) => {
  const { name, startTime, endTime } = req.body as { name?: string; startTime?: string; endTime?: string };
  if (!name || !startTime || !endTime) {
    return res.status(400).json({ error: 'Name, startTime and endTime are required' });
  }
  const template = await prisma.shiftTemplate.create({
    data: { userId: req.userId!, name, startTime, endTime },
  });
  res.status(201).json(template);
});

shiftTemplateRouter.put(
  '/:id',
  withNotFoundHandling(async (req: AuthedRequest, res) => {
    await findOwnedOrThrow(
      () => prisma.shiftTemplate.findUnique({ where: { id: req.params.id } }),
      req.userId,
      'Shift template not found'
    );
    const { name, startTime, endTime } = req.body as { name?: string; startTime?: string; endTime?: string };
    const template = await prisma.shiftTemplate.update({
      where: { id: req.params.id },
      data: { name, startTime, endTime },
    });
    res.json(template);
  })
);

shiftTemplateRouter.delete(
  '/:id',
  withNotFoundHandling(async (req: AuthedRequest, res) => {
    await findOwnedOrThrow(
      () => prisma.shiftTemplate.findUnique({ where: { id: req.params.id } }),
      req.userId,
      'Shift template not found'
    );
    await prisma.shiftTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
