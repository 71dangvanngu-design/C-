import type {
  Category,
  HeaderTab,
  Lesson,
  LessonStatus,
  SiteSection,
  SiteSettings,
  UserProfile,
  UserRole,
} from '../types/hub.ts';
import {
  HubSqlDatabase,
  getInitialAdminPassword,
  verifyPasswordHash,
} from './sqlDb.ts';
import {
  ensureSupabaseDefaultAdmin,
  getSupabaseAdminClient,
  getSupabasePublicClient,
  isSupabaseConfigured,
} from './supabaseAdmin.ts';

let sqlDbInstance: HubSqlDatabase | null = null;

function getSqlDb(): HubSqlDatabase {
  if (!sqlDbInstance) {
    sqlDbInstance = new HubSqlDatabase();
  }
  return sqlDbInstance;
}

export async function initializeAuthInfrastructure(): Promise<void> {
  getSqlDb();
  if (isSupabaseConfigured()) {
    await ensureSupabaseDefaultAdmin(getInitialAdminPassword());
  }
}

export async function authenticateUser(
  identifier: string,
  password: string
): Promise<UserProfile | null> {
  const cleaned = identifier.trim();
  if (!cleaned || !password) return null;

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    const pub = getSupabasePublicClient();
    if (admin && pub) {
      const { data: matchedProfile } = await admin
        .from('profiles')
        .select('*')
        .or(`username.ilike.${cleaned},email.ilike.${cleaned}`)
        .maybeSingle();

      if (!matchedProfile || !matchedProfile.is_active) {
        return null;
      }

      const { data: signInData, error: signInError } = await pub.auth.signInWithPassword({
        email: matchedProfile.email,
        password,
      });

      if (signInError || !signInData.user) {
        return null;
      }

      return {
        id: matchedProfile.id,
        username: matchedProfile.username,
        email: matchedProfile.email,
        role: matchedProfile.role as UserRole,
        accountType: matchedProfile.account_type,
        mustChangePassword: Boolean(matchedProfile.must_change_password),
        isActive: Boolean(matchedProfile.is_active),
        createdAt: matchedProfile.created_at,
        updatedAt: matchedProfile.updated_at,
      };
    }
  }

  const db = getSqlDb();
  const user = db.findUserByIdentifier(cleaned);
  if (!user || !user.isActive) return null;

  const valid = verifyPasswordHash(password, user.passwordHash, user.passwordSalt);
  if (!valid) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    accountType: user.accountType,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerStandardUser(input: {
  email: string;
  username: string;
  password: string;
}): Promise<{ ok: true; user: UserProfile } | { ok: false; error: string }> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .or(`username.ilike.${input.username},email.ilike.${input.email}`)
        .maybeSingle();
      if (existing) {
        return { ok: false, error: 'An account with this email or username already exists.' };
      }
      const { data: created, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { username: input.username },
      });
      if (error || !created.user) {
        return { ok: false, error: error?.message ?? 'Registration failed.' };
      }
      const now = new Date().toISOString();
      const profile = {
        id: created.user.id,
        username: input.username,
        email: input.email,
        role: 'user' as const,
        account_type: 'Standard User' as const,
        must_change_password: false,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      await admin.from('profiles').upsert(profile);
      return {
        ok: true,
        user: {
          id: profile.id,
          username: profile.username,
          email: profile.email,
          role: 'user',
          accountType: 'Standard User',
          mustChangePassword: false,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      };
    }
  }

  return getSqlDb().createUser(input);
}

export async function getUserProfileById(userId: string): Promise<UserProfile | null> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        username: data.username,
        email: data.email,
        role: data.role as UserRole,
        accountType: data.account_type,
        mustChangePassword: Boolean(data.must_change_password),
        isActive: Boolean(data.is_active),
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  }

  return getSqlDb().getUserById(userId);
}

export async function updateUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true; user: UserProfile } | { ok: false; error: string }> {
  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    const pub = getSupabasePublicClient();
    if (admin && pub) {
      const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!profile) return { ok: false, error: 'Account not found.' };
      const { error: verifyErr } = await pub.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });
      if (verifyErr) return { ok: false, error: 'Current password is incorrect.' };

      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (updErr) return { ok: false, error: updErr.message };

      const now = new Date().toISOString();
      await admin
        .from('profiles')
        .update({ must_change_password: false, updated_at: now })
        .eq('id', userId);

      const updated = await getUserProfileById(userId);
      if (!updated) return { ok: false, error: 'Failed to load updated profile.' };
      return { ok: true, user: updated };
    }
  }

  return getSqlDb().updateUserPassword(userId, currentPassword, newPassword);
}

export async function requestPasswordRecovery(identifier: string): Promise<void> {
  const cleaned = identifier.trim().toLowerCase();
  if (!cleaned) return;

  if (isSupabaseConfigured()) {
    const admin = getSupabaseAdminClient();
    const pub = getSupabasePublicClient();
    if (admin && pub) {
      const { data: profile } = await admin
        .from('profiles')
        .select('email')
        .or(`username.ilike.${cleaned},email.ilike.${cleaned}`)
        .maybeSingle();
      if (profile?.email) {
        await pub.auth.resetPasswordForEmail(profile.email);
      }
      return;
    }
  }

  getSqlDb().createResetToken(cleaned);
}

export function getPublicSiteData() {
  const db = getSqlDb();
  return {
    settings: db.getSettings(),
    headerTabs: db.getHeaderTabs(true),
    sections: db.getSections(true),
    categories: db.getCategories(),
    lessons: db.getLessons(true),
  };
}

export function getLessonBySlug(slug: string, isAdmin: boolean): Lesson | null {
  return getSqlDb().getLessonBySlug(slug, isAdmin);
}

export function getAdminOverview() {
  const db = getSqlDb();
  const pub = getPublicSiteData();
  return {
    ...pub,
    allHeaderTabs: db.getHeaderTabs(false),
    allSections: db.getSections(false),
    allLessons: db.getLessons(false),
    users: db.getAllUsers(),
    authProviderMode: isSupabaseConfigured()
      ? ('supabase' as const)
      : ('local-secure-vault' as const),
  };
}

export function createLesson(
  authorId: string,
  payload: {
    title: string;
    summary: string;
    content: string;
    cppStarter?: string;
    categoryId: string;
    level?: 'Beginner' | 'Intermediate' | 'Advanced';
    readMinutes?: number;
    imageUrl?: string;
    status?: LessonStatus;
  }
): Lesson {
  return getSqlDb().createLesson(authorId, payload);
}

export function updateLesson(
  id: string,
  patch: Partial<Omit<Lesson, 'id' | 'authorId' | 'createdAt'>>
): Lesson | null {
  return getSqlDb().updateLesson(id, patch);
}

export function deleteLesson(id: string): boolean {
  return getSqlDb().deleteLesson(id);
}

export function createCategory(name: string, description: string): Category {
  return getSqlDb().createCategory(name, description);
}

export function deleteCategory(id: string): boolean {
  return getSqlDb().deleteCategory(id);
}

export function createHeaderTab(label: string, href: string): HeaderTab {
  return getSqlDb().createHeaderTab(label, href);
}

export function updateHeaderTab(id: string, patch: Partial<Omit<HeaderTab, 'id'>>): HeaderTab | null {
  return getSqlDb().updateHeaderTab(id, patch);
}

export function deleteHeaderTab(id: string): boolean {
  return getSqlDb().deleteHeaderTab(id);
}

export function reorderHeaderTabs(orderedIds: string[]): HeaderTab[] {
  return getSqlDb().reorderHeaderTabs(orderedIds);
}

export function updateSections(sections: SiteSection[]): SiteSection[] {
  return getSqlDb().updateSections(sections);
}

export function updateSettings(patch: Partial<SiteSettings>): SiteSettings {
  return getSqlDb().updateSettings(patch);
}

export function adminUpdateUser(
  userId: string,
  patch: { role?: UserRole; isActive?: boolean }
): UserProfile | null {
  return getSqlDb().adminUpdateUser(userId, patch);
}
