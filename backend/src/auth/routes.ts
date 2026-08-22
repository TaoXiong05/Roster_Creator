import { Router } from 'express';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from './password';
import { signToken } from './jwt';
import { requireAuth, AuthedRequest } from './middleware';
import { authLimiter } from '../rateLimit';

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Email and password (min 6 chars) are required' });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.status(201).json({ id: user.id, email: user.email });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ id: user.id, email: user.email });
});

authRouter.post('/demo', authLimiter, async (_req, res) => {
  const demoEmail = process.env.DEMO_USER_EMAIL;
  if (!demoEmail) {
    return res.status(404).json({ error: 'Demo login is not enabled' });
  }
  const user = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!user) {
    return res.status(404).json({ error: 'Demo account not found' });
  }
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.json({ id: user.id, email: user.email });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.status(204).send();
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email });
});
