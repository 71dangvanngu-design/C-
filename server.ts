import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import {
  GENERIC_LOGIN_FAILED_MESSAGE,
  PASSWORD_CHANGE_REQUIRED_CODE,
  canChangeTargetRole,
  canPerformAdminAction,
  hasAdminAccess,
  sanitizeRegistrationPayload,
  validateAdminNewPassword,
  validatePasswordStrength,
} from './src/lib/authPolicy.ts';
import {
  adminUpdateUser,
  authenticateUser,
  createCategory,
  createHeaderTab,
  createLesson,
  deleteCategory,
  deleteHeaderTab,
  deleteLesson,
  getAdminOverview,
  getLessonBySlug,
  getPublicSiteData,
  getUserProfileById,
  initializeAuthInfrastructure,
  registerStandardUser,
  reorderHeaderTabs,
  requestPasswordRecovery,
  updateHeaderTab,
  updateLesson,
  updateSections,
  updateSettings,
  updateUserPassword,
} from './src/server/store.ts';
import type { UserProfile } from './src/types/hub.ts';

const COOKIE_NAME = 'dkh_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + '_dkh_vault_key').digest('hex');

interface SessionPayload {
  uid: string;
  exp: number;
}

interface AuthedRequest extends Request {
  authUser?: UserProfile;
}

function signSessionToken(uid: string): string {
  const payload: SessionPayload = {
    uid,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setSessionCookie(res: Response, uid: string): void {
  const token = signSessionToken(uid);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function resolveAuthUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  const parsed = verifySessionToken(token);
  if (parsed) {
    const profile = await getUserProfileById(parsed.uid);
    if (profile && profile.isActive) {
      req.authUser = profile;
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}

function requireAdminRead(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!hasAdminAccess(req.authUser)) {
    res.status(403).json({ error: 'Forbidden: administrator privileges required.' });
    return;
  }
  next();
}

function requireAdminMutation(req: AuthedRequest, res: Response, next: NextFunction) {
  const check = canPerformAdminAction(req.authUser);
  if (!check.allowed) {
    if (check.reason === 'UNAUTHENTICATED') {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (check.reason === 'PASSWORD_CHANGE_REQUIRED') {
      res.status(403).json({
        error: PASSWORD_CHANGE_REQUIRED_CODE,
        message: 'You must change the initial default password before accessing admin mutations.',
      });
      return;
    }
    res.status(403).json({ error: 'Forbidden: administrator privileges required.' });
    return;
  }
  next();
}

async function startServer() {
  await initializeAuthInfrastructure();

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(resolveAuthUser);

  // AUTH ROUTES
  app.get('/api/auth/me', (req: AuthedRequest, res: Response) => {
    res.json({ user: req.authUser ?? null });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    if (typeof identifier !== 'string' || typeof password !== 'string') {
      res.status(401).json({ error: GENERIC_LOGIN_FAILED_MESSAGE });
      return;
    }

    const user = await authenticateUser(identifier, password);
    if (!user) {
      res.status(401).json({ error: GENERIC_LOGIN_FAILED_MESSAGE });
      return;
    }

    setSessionCookie(res, user.id);
    res.json({ user });
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const site = getPublicSiteData();
    if (!site.settings.enableRegistration) {
      res.status(403).json({ error: 'Registration is currently disabled by administrator.' });
      return;
    }

    const sanitized = sanitizeRegistrationPayload(req.body ?? {});
    if (!sanitized.ok) {
      res.status(400).json({ error: sanitized.error });
      return;
    }

    const result = await registerStandardUser({
      email: sanitized.email,
      username: sanitized.username,
      password: sanitized.password,
    });

    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    setSessionCookie(res, result.user.id);
    res.status(201).json({ user: result.user });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Current and new passwords are required.' });
      return;
    }

    const user = req.authUser!;
    const check =
      user.role === 'admin' && user.mustChangePassword
        ? validateAdminNewPassword(newPassword, currentPassword)
        : validatePasswordStrength(newPassword);

    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }

    const updated = await updateUserPassword(user.id, currentPassword, newPassword);
    if (!updated.ok) {
      res.status(400).json({ error: updated.error });
      return;
    }

    res.json({ user: updated.user });
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    const { identifier } = req.body as { identifier?: string };
    if (typeof identifier !== 'string' || !identifier.trim()) {
      res.status(400).json({ error: 'Please provide your username or email.' });
      return;
    }
    await requestPasswordRecovery(identifier);
    // Always return generic response so account existence is never disclosed
    res.json({
      ok: true,
      message: 'If a matching account exists, recovery instructions have been dispatched.',
    });
  });

  // PUBLIC / USER SITE ROUTES
  app.get('/api/site', (_req: Request, res: Response) => {
    res.json(getPublicSiteData());
  });

  app.get('/api/lessons/:slug', (req: AuthedRequest, res: Response) => {
    const isAdmin = hasAdminAccess(req.authUser);
    const lesson = getLessonBySlug(String(req.params.slug), isAdmin);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    res.json({ lesson });
  });

  // PROTECTED ADMIN CONTROL PANEL ROUTES
  app.get('/api/admin/overview', requireAdminRead, (_req: AuthedRequest, res: Response) => {
    res.json(getAdminOverview());
  });

  app.post('/api/admin/lessons', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const { title, summary, content, cppStarter, categoryId, level, readMinutes, imageUrl, status } =
      req.body ?? {};
    if (!title || !summary || !content || !categoryId) {
      res.status(400).json({ error: 'Title, summary, content, and category are required.' });
      return;
    }
    const created = createLesson(req.authUser!.id, {
      title,
      summary,
      content,
      cppStarter,
      categoryId,
      level,
      readMinutes,
      imageUrl,
      status,
    });
    res.status(201).json({ lesson: created });
  });

  app.patch('/api/admin/lessons/:id', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const updated = updateLesson(String(req.params.id), req.body ?? {});
    if (!updated) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    res.json({ lesson: updated });
  });

  app.delete('/api/admin/lessons/:id', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const ok = deleteLesson(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/categories', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const { name, description } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const created = createCategory(name, typeof description === 'string' ? description : '');
    res.status(201).json({ category: created });
  });

  app.delete('/api/admin/categories/:id', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const ok = deleteCategory(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/header-tabs', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const { label, href } = req.body ?? {};
    if (!label || typeof label !== 'string') {
      res.status(400).json({ error: 'Tab label is required.' });
      return;
    }
    const tab = createHeaderTab(label, typeof href === 'string' ? href : '/');
    res.status(201).json({ tab });
  });

  app.patch('/api/admin/header-tabs/:id', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const tab = updateHeaderTab(String(req.params.id), req.body ?? {});
    if (!tab) {
      res.status(404).json({ error: 'Header tab not found.' });
      return;
    }
    res.json({ tab });
  });

  app.delete('/api/admin/header-tabs/:id', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const ok = deleteHeaderTab(String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: 'Header tab not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.put('/api/admin/header-tabs/reorder', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const { orderedIds } = req.body as { orderedIds?: string[] };
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds array is required.' });
      return;
    }
    const tabs = reorderHeaderTabs(orderedIds);
    res.json({ tabs });
  });

  app.put('/api/admin/sections', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const { sections } = req.body ?? {};
    if (!Array.isArray(sections)) {
      res.status(400).json({ error: 'sections array is required.' });
      return;
    }
    const updated = updateSections(sections);
    res.json({ sections: updated });
  });

  app.patch('/api/admin/settings', requireAdminMutation, (req: AuthedRequest, res: Response) => {
    const updated = updateSettings(req.body ?? {});
    res.json({ settings: updated });
  });

  app.patch('/api/admin/users/:id', requireAdminMutation, async (req: AuthedRequest, res: Response) => {
    const targetId = String(req.params.id);
    const target = await getUserProfileById(targetId);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { role, isActive } = req.body as { role?: 'admin' | 'user'; isActive?: boolean };
    if (role !== undefined) {
      const check = canChangeTargetRole(req.authUser!, target, role);
      if (!check.allowed) {
        res.status(400).json({ error: check.error });
        return;
      }
    }

    const updated = adminUpdateUser(targetId, { role, isActive });
    res.json({ user: updated });
  });

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`DIGITAL KNOWLEDGE HUB listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
