import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';
import { findOwnedOrThrow, withNotFoundHandling } from '../routeHelpers';

export const groupMembershipRouter = Router();
groupMembershipRouter.use(requireAuth);

function findOwnedGroup(groupId: string, userId: string | undefined) {
  return findOwnedOrThrow(
    () => prisma.staffGroup.findUnique({ where: { id: groupId } }),
    userId,
    'Group not found'
  );
}

groupMembershipRouter.get(
  '/:id/members',
  withNotFoundHandling(async (req: AuthedRequest, res) => {
    await findOwnedGroup(req.params.id, req.userId);

    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.id },
      include: { staff: { include: { preference: true } } },
    });
    res.json(members.map((m) => m.staff));
  })
);

groupMembershipRouter.post(
  '/:id/members',
  withNotFoundHandling(async (req: AuthedRequest, res) => {
    await findOwnedGroup(req.params.id, req.userId);

    const { staffId } = req.body as { staffId?: string };
    if (!staffId) return res.status(400).json({ error: 'staffId is required' });

    await findOwnedOrThrow(
      () => prisma.staff.findUnique({ where: { id: staffId } }),
      req.userId,
      'Staff not found'
    );

    await prisma.groupMember.create({ data: { groupId: req.params.id, staffId } });
    res.status(201).send();
  })
);

groupMembershipRouter.delete(
  '/:id/members/:staffId',
  withNotFoundHandling(async (req: AuthedRequest, res) => {
    await findOwnedGroup(req.params.id, req.userId);

    await prisma.groupMember.delete({
      where: { groupId_staffId: { groupId: req.params.id, staffId: req.params.staffId } },
    });
    res.status(204).send();
  })
);
