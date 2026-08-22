import 'express-async-errors';
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
import { responsibilityRouter } from './responsibilities/routes';
import { rosterRouter } from './rosters/routes';
import { assignmentRouter } from './rosters/assignmentRoutes';
import { exportRouter } from './rosters/exportRoutes';
import { emailRouter } from './rosters/emailRoutes';
import { apiLimiter } from './rateLimit';

export function createApp() {
  const app = express();
  // Behind the Caddy reverse proxy (see proxy/Caddyfile) — trust its X-Forwarded-For so
  // req.ip (used for rate limiting) reflects the real client, not the proxy container.
  app.set('trust proxy', 1);
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(apiLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter);
  app.use('/auth', googleAuthRouter);
  app.use('/auth', passwordResetRouter);
  app.use('/staff', staffRouter);
  app.use('/staff', preferenceRouter);
  app.use('/groups', groupsRouter);
  app.use('/groups', groupMembershipRouter);
  app.use('/shift-templates', shiftTemplateRouter);
  app.use('/responsibilities', responsibilityRouter);
  app.use('/rosters', rosterRouter);
  app.use('/rosters', assignmentRouter);
  app.use('/rosters', exportRouter);
  app.use('/rosters', emailRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found' });
    }
    if (err?.code === 'P2003') {
      return res.status(409).json({ error: 'This item is referenced elsewhere and cannot be deleted' });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
