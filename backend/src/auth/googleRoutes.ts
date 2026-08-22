import { Router, Request, Response, NextFunction } from 'express';
import { passport } from './passport';
import { signToken } from './jwt';
import { TOKEN_COOKIE_MAX_AGE_MS } from './routes';

export const googleAuthRouter = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export function handleGoogleCallback(req: Request, res: Response) {
  const user = req.user as { id: string };
  const token = signToken({ userId: user.id });
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_COOKIE_MAX_AGE_MS,
  });
  res.redirect(`${FRONTEND_URL}/dashboard`);
}

googleAuthRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

googleAuthRouter.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', { session: false }, (err: unknown, user: unknown) => {
      if (err || !user) {
        return res.redirect(`${FRONTEND_URL}/login?error=google_auth_failed`);
      }
      req.user = user as Express.User;
      return handleGoogleCallback(req, res);
    })(req, res, next);
  }
);
