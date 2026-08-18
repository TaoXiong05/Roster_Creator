import { Router, Request, Response } from 'express';
import { passport } from './passport';
import { signToken } from './jwt';

export const googleAuthRouter = Router();

export function handleGoogleCallback(req: Request, res: Response) {
  const user = req.user as { id: string };
  const token = signToken({ userId: user.id });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`);
}

googleAuthRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

googleAuthRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  handleGoogleCallback
);
