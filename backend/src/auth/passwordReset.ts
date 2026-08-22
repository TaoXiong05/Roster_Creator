import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { hashPassword } from './password';
import { sendEmail } from '../email/resend';
import { authLimiter } from '../rateLimit';

export const passwordResetRouter = Router();

const RESET_TOKEN_TTL_MS = 20 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

passwordResetRouter.post('/password-reset/request', authLimiter, async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return res.status(202).json({ message: 'If that email exists, a reset link was sent' });
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: '重置你的密码',
    html: `<p>点击链接重置密码（20 分钟内有效）：</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });

  res.status(202).json({ message: 'If that email exists, a reset link was sent' });
});

passwordResetRouter.post('/password-reset/confirm', authLimiter, async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password || password.length < 6) {
    return res.status(400).json({ error: 'Token and password (min 6 chars) are required' });
  }

  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash } });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } });
  await prisma.passwordResetToken.delete({ where: { id: record.id } });

  res.status(204).send();
});
