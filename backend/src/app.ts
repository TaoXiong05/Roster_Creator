import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { authRouter } from './auth/routes';
import { googleAuthRouter } from './auth/googleRoutes';
import { passwordResetRouter } from './auth/passwordReset';
import { staffRouter } from './staff/routes';
import { preferenceRouter } from './staff/preferenceRoutes';
import { groupsRouter } from './groups/routes';
import { groupMembershipRouter } from './groups/membershipRoutes';
import { shiftTemplateRouter } from './shiftTemplates/routes';
import { rosterRouter } from './rosters/routes';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/auth', googleAuthRouter);
  app.use('/auth', passwordResetRouter);
  app.use('/staff', staffRouter);
  app.use('/staff', preferenceRouter);
  app.use('/groups', groupsRouter);
  app.use('/groups', groupMembershipRouter);
  app.use('/shift-templates', shiftTemplateRouter);
  app.use('/rosters', rosterRouter);

  return app;
}
