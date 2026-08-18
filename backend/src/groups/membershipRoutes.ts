import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth/middleware';

export const groupMembershipRouter = Router();
groupMembershipRouter.use(requireAuth);

async function ensureOwnedGroup(groupId: string, userId: string) {
  const group = await prisma.staffGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) return null;
  return group;
}

groupMembershipRouter.get('/:id/members', async (req: AuthedRequest, res) => {
  const group = await ensureOwnedGroup(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = await prisma.groupMember.findMany({
    where: { groupId: req.params.id },
    include: { staff: true },
  });
  res.json(members.map((m) => m.staff));
});

groupMembershipRouter.post('/:id/members', async (req: AuthedRequest, res) => {
  const group = await ensureOwnedGroup(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const { staffId } = req.body as { staffId?: string };
  if (!staffId) return res.status(400).json({ error: 'staffId is required' });

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.userId !== req.userId) {
    return res.status(404).json({ error: 'Staff not found' });
  }

  await prisma.groupMember.create({ data: { groupId: req.params.id, staffId } });
  res.status(201).send();
});

groupMembershipRouter.delete('/:id/members/:staffId', async (req: AuthedRequest, res) => {
  const group = await ensureOwnedGroup(req.params.id, req.userId!);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  await prisma.groupMember.delete({
    where: { groupId_staffId: { groupId: req.params.id, staffId: req.params.staffId } },
  });
  res.status(204).send();
});
