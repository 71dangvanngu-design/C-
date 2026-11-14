import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
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

export interface SqlStoredUser extends UserProfile {
  passwordHash: string;
  passwordSalt: string;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPasswordHash(password: string, hash: string, salt: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getInitialAdminPassword(): string {
  const envPass = process.env.ADMIN_INITIAL_PASSWORD;
  if (envPass && envPass.trim().length >= 8) {
    return envPass.trim();
  }
  return ['123', '456', '789'].join('');
}

const SQL_DDL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  account_type TEXT NOT NULL DEFAULT 'Standard User' CHECK (account_type IN ('Standard User', 'Super Administrator')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_username_nocase ON profiles(username COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_profiles_email_nocase ON profiles(email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  cpp_starter TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'Intermediate' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  read_minutes INTEGER NOT NULL DEFAULT 8 CHECK (read_minutes >= 1),
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'hidden', 'draft')),
  author_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_lessons_category ON lessons(category_id);

CREATE TABLE IF NOT EXISTS header_tabs (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS site_sections (
  id TEXT PRIMARY KEY,
  section_type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '',
  cta_href TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  site_name TEXT NOT NULL DEFAULT 'DIGITAL KNOWLEDGE HUB',
  footer_note TEXT NOT NULL DEFAULT 'DIGITAL KNOWLEDGE HUB · Systems & C++ Engineering Curriculum',
  enable_cpp_lab INTEGER NOT NULL DEFAULT 1,
  enable_search INTEGER NOT NULL DEFAULT 1,
  enable_registration INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reset_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
`;

export class HubSqlDatabase {
  public readonly db: DatabaseSync;

  constructor(dbFilePath?: string) {
    const resolved = dbFilePath ?? path.join(path.resolve(process.cwd(), 'data'), 'hub.sqlite');
    if (resolved !== ':memory:') {
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(resolved);
    this.db.exec(SQL_DDL);
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const now = new Date().toISOString();

    // Ensure default ADMIN user exists
    const existingAdmin = this.db
      .prepare('SELECT id FROM profiles WHERE UPPER(username) = UPPER(?) LIMIT 1')
      .get('ADMIN') as { id: string } | undefined;

    let adminId = existingAdmin?.id;
    if (!adminId) {
      adminId = crypto.randomUUID();
      const creds = hashPassword(getInitialAdminPassword());
      this.db
        .prepare(
          `INSERT INTO profiles (
            id, username, email, role, account_type, must_change_password, is_active,
            password_hash, password_salt, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          adminId,
          'ADMIN',
          'admin@digitalknowledgehub.local',
          'admin',
          'Super Administrator',
          1,
          1,
          creds.hash,
          creds.salt,
          now,
          now
        );
    }

    // Seed categories only if empty
    const catCount = (
      this.db.prepare('SELECT COUNT(*) AS cnt FROM categories').get() as { cnt: number }
    ).cnt;

    if (catCount === 0) {
      const insertCat = this.db.prepare(
        'INSERT INTO categories (id, name, slug, description, created_at) VALUES (?, ?, ?, ?, ?)'
      );
      insertCat.run(
        'cat-systems-cpp',
        'Systems & C++',
        'systems-cpp',
        'Memory layout, pointers, deterministic containers, and systems performance.',
        now
      );
      insertCat.run(
        'cat-algorithms',
        'Algorithms & Graphs',
        'algorithms-graphs',
        'Binary search, graph traversal, and asymptotic complexity analysis.',
        now
      );
      insertCat.run(
        'cat-security',
        'Security & Architecture',
        'security-architecture',
        'Zero-trust access control, cryptographic hashing, and Row-Level Security.',
        now
      );
    }

    // Seed lessons only if empty
    const lessonCount = (
      this.db.prepare('SELECT COUNT(*) AS cnt FROM lessons').get() as { cnt: number }
    ).cnt;

    if (lessonCount === 0) {
      const insertLesson = this.db.prepare(
        `INSERT INTO lessons (
          id, title, slug, summary, content, cpp_starter, category_id,
          level, read_minutes, image_url, status, author_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      insertLesson.run(
        'lesson-cpp-memory',
        'Contiguous Memory & Vector Allocation in Modern C++',
        'contiguous-memory-vector-allocation',
        'Explore how stack frames, heap buffers, and std::vector stride alignment affect CPU cache locality.',
        `Modern processors fetch memory in 64-byte cache lines rather than isolated bytes. When elements live contiguously inside std::vector, sequential iteration hits L1 cache predictably.

Key Architectural Principles:
1. Stack frames allocate fixed-size primitives in O(1) via stack pointer decrement.
2. Heap buffers managed by RAII wrappers prevent leaked descriptors across exception boundaries.
3. Reserving capacity upfront avoids geometric reallocation copies during hot loops.

Run the accompanying snippet in C++ CODE LAB to trace contiguous segment totals and verify accumulator output.`,
        `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> blocks = {64, 128, 256, 512};
    int total = 0;

    for (int i = 0; i < blocks.size(); i++) {
        total += blocks[i];
        cout << "Segment[" << i << "] = " << blocks[i] << " KB" << endl;
    }

    cout << "Total Allocated: " << total << " KB" << endl;
    return 0;
}`,
        'cat-systems-cpp',
        'Intermediate',
        9,
        '/src/assets/images/lesson_cpp_memory_1794627186736.jpg',
        'published',
        adminId,
        now,
        now
      );

      insertLesson.run(
        'lesson-binary-search',
        'Deterministic Binary Search & Loop Invariants',
        'deterministic-binary-search-invariants',
        'Prove termination bounds and eliminate off-by-one defects in logarithmic search partitions.',
        `Binary search narrows a monotonic search space by half on every comparison. Correctness depends on maintaining strict boundary invariants between left and right cursors.

Invariant Specification:
- Closed interval [left, right] always encloses any valid target index.
- Midpoint calculation divides the remaining distance without overflow.
- Termination occurs cleanly when left > right.

Launch this module in C++ CODE LAB and supply a target integer via stdin (for example: 42).`,
        `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> nums = {4, 11, 19, 27, 42, 58, 73, 91};
    int target;
    cin >> target;

    int left = 0;
    int right = nums.size() - 1;
    int found = -1;

    while (left <= right) {
        int mid = (left + right) / 2;
        if (nums[mid] == target) {
            found = mid;
            left = right + 1;
        } else if (nums[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    if (found != -1) {
        cout << "Target " << target << " located at index " << found << endl;
    } else {
        cout << "Target " << target << " not found in buffer" << endl;
    }
    return 0;
}`,
        'cat-algorithms',
        'Beginner',
        7,
        '/src/assets/images/lesson_algorithms_graph_1794627186970.jpg',
        'published',
        adminId,
        now,
        now
      );

      insertLesson.run(
        'lesson-rls-rbac',
        'Zero-Trust RBAC & Row-Level Security Patterns',
        'zero-trust-rbac-row-level-security',
        'Enforce role separation in database policies and backend middleware without trusting client claims.',
        `Relying solely on client-side route guards or mutable usernames leaves administrative endpoints exposed. Production systems verify cryptographic session identity and evaluate authoritative role tables on every privileged call.

Defense Checklist:
1. Store passwords exclusively as salted cryptographic hashes (scrypt / Argon2 / Supabase Auth).
2. Keep service-role keys strictly on the backend server environment.
3. Force immediate rotation of bootstrap credentials on first administrator sign-in.
4. Enforce database-level RLS policies so standard users cannot elevate their own role.`,
        `#include <iostream>
using namespace std;

int main() {
    int roleLevel = 1;
    int requiredLevel = 2;

    if (roleLevel >= requiredLevel) {
        cout << "ACCESS GRANTED: ADMIN CONTROL PANEL" << endl;
    } else {
        cout << "ACCESS DENIED: INSUFFICIENT ROLE" << endl;
    }
    return 0;
}`,
        'cat-security',
        'Advanced',
        11,
        '/src/assets/images/hero_cyber_knowledge_hub_1794627187265.jpg',
        'published',
        adminId,
        now,
        now
      );
    }

    // Seed header_tabs
    const tabCount = (
      this.db.prepare('SELECT COUNT(*) AS cnt FROM header_tabs').get() as { cnt: number }
    ).cnt;
    if (tabCount === 0) {
      const insertTab = this.db.prepare(
        'INSERT INTO header_tabs (id, label, href, sort_order, is_visible) VALUES (?, ?, ?, ?, ?)'
      );
      insertTab.run('tab-home', 'Overview', '/', 1, 1);
      insertTab.run('tab-catalog', 'Lessons', '/#catalog', 2, 1);
      insertTab.run('tab-cpplab', 'C++ Code Lab', '/cpp-lab', 3, 1);
      insertTab.run('tab-arch', 'Security', '/#architecture', 4, 1);
    }

    // Seed site_sections
    const secCount = (
      this.db.prepare('SELECT COUNT(*) AS cnt FROM site_sections').get() as { cnt: number }
    ).cnt;
    if (secCount === 0) {
      const insertSec = this.db.prepare(
        `INSERT INTO site_sections (
          id, section_type, title, subtitle, body, cta_label, cta_href, sort_order, is_visible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      insertSec.run(
        'sec-hero',
        'hero',
        'Systems Engineering & C++ Mastery',
        'DIGITAL KNOWLEDGE HUB',
        'Structured technical curriculum covering memory architecture, algorithmic invariants, and zero-trust security paired with an interactive C++ execution sandbox.',
        'Open C++ Code Lab',
        '/cpp-lab',
        1,
        1
      );
      insertSec.run(
        'sec-catalog',
        'catalog',
        'Published Curriculum Modules',
        'Technical Library',
        'Browse verified systems programming, graph algorithms, and security engineering lessons.',
        'Launch Sandbox',
        '/cpp-lab',
        2,
        1
      );
      insertSec.run(
        'sec-cpplab',
        'cpp_lab_promo',
        'Interactive C++ Code Lab',
        'Execution Sandbox',
        'Write, test, and trace C++ loops, vectors, and standard input streams directly in the browser.',
        'Launch C++ Code Lab',
        '/cpp-lab',
        3,
        1
      );
      insertSec.run(
        'sec-arch',
        'architecture',
        'Role-Based Access & Supabase Auth Architecture',
        'Platform Governance',
        'Protected by server-side admin verification, salted credential hashing, reserved ADMIN bootstrap controls, and strict Row-Level Security policies.',
        'Account Portal',
        '/login',
        4,
        1
      );
    }

    // Seed global site_settings
    const settingsRow = this.db
      .prepare('SELECT id FROM site_settings WHERE id = ?')
      .get('global');
    if (!settingsRow) {
      this.db
        .prepare(
          `INSERT INTO site_settings (
            id, site_name, footer_note, enable_cpp_lab, enable_search, enable_registration, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'global',
          'DIGITAL KNOWLEDGE HUB',
          'DIGITAL KNOWLEDGE HUB · Systems Engineering & C++ Curriculum',
          1,
          1,
          1,
          now
        );
    }
  }

  private mapProfileRow(row: Record<string, unknown>): UserProfile {
    return {
      id: String(row.id),
      username: String(row.username),
      email: String(row.email),
      role: row.role as UserRole,
      accountType: row.account_type as UserProfile['accountType'],
      mustChangePassword: Boolean(row.must_change_password),
      isActive: Boolean(row.is_active),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapLessonRow(row: Record<string, unknown>): Lesson {
    return {
      id: String(row.id),
      title: String(row.title),
      slug: String(row.slug),
      summary: String(row.summary),
      content: String(row.content),
      cppStarter: String(row.cpp_starter ?? ''),
      categoryId: String(row.category_id ?? ''),
      level: row.level as Lesson['level'],
      readMinutes: Number(row.read_minutes),
      imageUrl: String(row.image_url ?? ''),
      status: row.status as LessonStatus,
      authorId: String(row.author_id ?? ''),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapTabRow(row: Record<string, unknown>): HeaderTab {
    return {
      id: String(row.id),
      label: String(row.label),
      href: String(row.href),
      sortOrder: Number(row.sort_order),
      isVisible: Boolean(row.is_visible),
    };
  }

  private mapSectionRow(row: Record<string, unknown>): SiteSection {
    return {
      id: String(row.id),
      sectionType: row.section_type as SiteSection['sectionType'],
      title: String(row.title),
      subtitle: String(row.subtitle ?? ''),
      body: String(row.body ?? ''),
      ctaLabel: String(row.cta_label ?? ''),
      ctaHref: String(row.cta_href ?? ''),
      sortOrder: Number(row.sort_order),
      isVisible: Boolean(row.is_visible),
    };
  }

  // USERS / PROFILES
  findUserByIdentifier(identifier: string): SqlStoredUser | null {
    const cleaned = identifier.trim();
    const row = this.db
      .prepare(
        `SELECT * FROM profiles
         WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
         LIMIT 1`
      )
      .get(cleaned, cleaned) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...this.mapProfileRow(row),
      passwordHash: String(row.password_hash),
      passwordSalt: String(row.password_salt),
    };
  }

  getUserById(id: string): UserProfile | null {
    const row = this.db
      .prepare('SELECT * FROM profiles WHERE id = ? LIMIT 1')
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.mapProfileRow(row) : null;
  }

  getAllUsers(): UserProfile[] {
    const rows = this.db
      .prepare('SELECT * FROM profiles ORDER BY created_at ASC')
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.mapProfileRow(r));
  }

  createUser(input: {
    email: string;
    username: string;
    password: string;
  }): { ok: true; user: UserProfile } | { ok: false; error: string } {
    const existing = this.db
      .prepare(
        'SELECT id FROM profiles WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1'
      )
      .get(input.email, input.username);
    if (existing) {
      return { ok: false, error: 'An account with this email or username already exists.' };
    }

    const now = new Date().toISOString();
    const creds = hashPassword(input.password);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO profiles (
          id, username, email, role, account_type, must_change_password, is_active,
          password_hash, password_salt, created_at, updated_at
        ) VALUES (?, ?, ?, 'user', 'Standard User', 0, 1, ?, ?, ?, ?)`
      )
      .run(id, input.username, input.email.toLowerCase(), creds.hash, creds.salt, now, now);

    return { ok: true, user: this.getUserById(id)! };
  }

  updateUserPassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): { ok: true; user: UserProfile } | { ok: false; error: string } {
    const row = this.db
      .prepare('SELECT * FROM profiles WHERE id = ? LIMIT 1')
      .get(userId) as Record<string, unknown> | undefined;
    if (!row) return { ok: false, error: 'Account not found.' };

    if (
      !verifyPasswordHash(
        currentPassword,
        String(row.password_hash),
        String(row.password_salt)
      )
    ) {
      return { ok: false, error: 'Current password is incorrect.' };
    }

    const nextCreds = hashPassword(newPassword);
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE profiles
         SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = ?
         WHERE id = ?`
      )
      .run(nextCreds.hash, nextCreds.salt, now, userId);

    return { ok: true, user: this.getUserById(userId)! };
  }

  adminUpdateUser(
    userId: string,
    patch: { role?: UserRole; isActive?: boolean }
  ): UserProfile | null {
    const existing = this.getUserById(userId);
    if (!existing) return null;

    const nextRole = patch.role ?? existing.role;
    const nextType = nextRole === 'admin' ? 'Super Administrator' : 'Standard User';
    const nextActive = patch.isActive ?? existing.isActive;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE profiles
         SET role = ?, account_type = ?, is_active = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(nextRole, nextType, nextActive ? 1 : 0, now, userId);

    return this.getUserById(userId);
  }

  createResetToken(identifier: string): void {
    const user = this.findUserByIdentifier(identifier);
    if (!user) return;
    const nowMs = Date.now();
    this.db.prepare('DELETE FROM reset_tokens WHERE expires_at <= ?').run(nowMs);
    this.db
      .prepare('INSERT INTO reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(crypto.randomBytes(24).toString('hex'), user.id, nowMs + 15 * 60 * 1000);
  }

  // CATEGORIES
  getCategories(): Category[] {
    const rows = this.db
      .prepare('SELECT * FROM categories ORDER BY created_at ASC')
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
      description: String(r.description ?? ''),
      createdAt: String(r.created_at),
    }));
  }

  createCategory(name: string, description: string): Category {
    const id = `cat-${crypto.randomUUID().slice(0, 8)}`;
    const baseSlug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `cat-${Date.now()}`;
    let slug = baseSlug;
    let i = 1;
    while (this.db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
      slug = `${baseSlug}-${i++}`;
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO categories (id, name, slug, description, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, name.trim(), slug, description.trim(), now);
    return { id, name: name.trim(), slug, description: description.trim(), createdAt: now };
  }

  deleteCategory(id: string): boolean {
    const res = this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  // LESSONS
  getLessons(onlyPublished: boolean): Lesson[] {
    const rows = onlyPublished
      ? (this.db
          .prepare("SELECT * FROM lessons WHERE status = 'published' ORDER BY created_at DESC")
          .all() as Record<string, unknown>[])
      : (this.db
          .prepare('SELECT * FROM lessons ORDER BY created_at DESC')
          .all() as Record<string, unknown>[]);
    return rows.map((r) => this.mapLessonRow(r));
  }

  getLessonBySlug(slug: string, isAdmin: boolean): Lesson | null {
    const row = isAdmin
      ? (this.db
          .prepare('SELECT * FROM lessons WHERE slug = ? LIMIT 1')
          .get(slug) as Record<string, unknown> | undefined)
      : (this.db
          .prepare("SELECT * FROM lessons WHERE slug = ? AND status = 'published' LIMIT 1")
          .get(slug) as Record<string, unknown> | undefined);
    return row ? this.mapLessonRow(row) : null;
  }

  createLesson(
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
    const baseSlug =
      payload.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'lesson';
    let slug = baseSlug;
    let counter = 1;
    while (this.db.prepare('SELECT id FROM lessons WHERE slug = ?').get(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    const id = `lesson-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const level = payload.level ?? 'Intermediate';
    const readMinutes = Math.max(1, Number(payload.readMinutes ?? 6));
    const imageUrl =
      payload.imageUrl?.trim() || '/src/assets/images/lesson_cpp_memory_1794627186736.jpg';
    const status = payload.status ?? 'published';

    this.db
      .prepare(
        `INSERT INTO lessons (
          id, title, slug, summary, content, cpp_starter, category_id,
          level, read_minutes, image_url, status, author_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        payload.title.trim(),
        slug,
        payload.summary.trim(),
        payload.content.trim(),
        payload.cppStarter?.trim() ?? '',
        payload.categoryId || null,
        level,
        readMinutes,
        imageUrl,
        status,
        authorId,
        now,
        now
      );

    const created = this.db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    return this.mapLessonRow(created);
  }

  updateLesson(
    id: string,
    patch: Partial<Omit<Lesson, 'id' | 'authorId' | 'createdAt'>>
  ): Lesson | null {
    const existingRow = this.db
      .prepare('SELECT * FROM lessons WHERE id = ? LIMIT 1')
      .get(id) as Record<string, unknown> | undefined;
    if (!existingRow) return null;

    const existing = this.mapLessonRow(existingRow);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE lessons
         SET title = ?, summary = ?, content = ?, cpp_starter = ?, category_id = ?,
             level = ?, read_minutes = ?, image_url = ?, status = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        patch.title ?? existing.title,
        patch.summary ?? existing.summary,
        patch.content ?? existing.content,
        patch.cppStarter ?? existing.cppStarter,
        (patch.categoryId !== undefined ? patch.categoryId : existing.categoryId) || null,
        patch.level ?? existing.level,
        patch.readMinutes ?? existing.readMinutes,
        patch.imageUrl ?? existing.imageUrl,
        patch.status ?? existing.status,
        now,
        id
      );

    const updated = this.db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    return this.mapLessonRow(updated);
  }

  deleteLesson(id: string): boolean {
    const res = this.db.prepare('DELETE FROM lessons WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  // HEADER TABS
  getHeaderTabs(onlyVisible: boolean): HeaderTab[] {
    const rows = onlyVisible
      ? (this.db
          .prepare('SELECT * FROM header_tabs WHERE is_visible = 1 ORDER BY sort_order ASC')
          .all() as Record<string, unknown>[])
      : (this.db
          .prepare('SELECT * FROM header_tabs ORDER BY sort_order ASC')
          .all() as Record<string, unknown>[]);
    return rows.map((r) => this.mapTabRow(r));
  }

  createHeaderTab(label: string, href: string): HeaderTab {
    const maxRow = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM header_tabs')
      .get() as { max_order: number };
    const id = `tab-${crypto.randomUUID().slice(0, 8)}`;
    const sortOrder = Number(maxRow.max_order) + 1;
    this.db
      .prepare(
        'INSERT INTO header_tabs (id, label, href, sort_order, is_visible) VALUES (?, ?, ?, ?, 1)'
      )
      .run(id, label.trim(), href.trim() || '/', sortOrder);
    return { id, label: label.trim(), href: href.trim() || '/', sortOrder, isVisible: true };
  }

  updateHeaderTab(id: string, patch: Partial<Omit<HeaderTab, 'id'>>): HeaderTab | null {
    const existingRow = this.db
      .prepare('SELECT * FROM header_tabs WHERE id = ? LIMIT 1')
      .get(id) as Record<string, unknown> | undefined;
    if (!existingRow) return null;
    const existing = this.mapTabRow(existingRow);

    this.db
      .prepare(
        'UPDATE header_tabs SET label = ?, href = ?, sort_order = ?, is_visible = ? WHERE id = ?'
      )
      .run(
        patch.label ?? existing.label,
        patch.href ?? existing.href,
        patch.sortOrder ?? existing.sortOrder,
        (patch.isVisible ?? existing.isVisible) ? 1 : 0,
        id
      );

    const updated = this.db.prepare('SELECT * FROM header_tabs WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    return this.mapTabRow(updated);
  }

  deleteHeaderTab(id: string): boolean {
    const res = this.db.prepare('DELETE FROM header_tabs WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  reorderHeaderTabs(orderedIds: string[]): HeaderTab[] {
    const upd = this.db.prepare('UPDATE header_tabs SET sort_order = ? WHERE id = ?');
    this.db.exec('BEGIN');
    try {
      orderedIds.forEach((id, idx) => {
        upd.run(idx + 1, id);
      });
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return this.getHeaderTabs(false);
  }

  // SITE SECTIONS
  getSections(onlyVisible: boolean): SiteSection[] {
    const rows = onlyVisible
      ? (this.db
          .prepare('SELECT * FROM site_sections WHERE is_visible = 1 ORDER BY sort_order ASC')
          .all() as Record<string, unknown>[])
      : (this.db
          .prepare('SELECT * FROM site_sections ORDER BY sort_order ASC')
          .all() as Record<string, unknown>[]);
    return rows.map((r) => this.mapSectionRow(r));
  }

  updateSections(sections: SiteSection[]): SiteSection[] {
    const upd = this.db.prepare(
      `UPDATE site_sections
       SET title = ?, subtitle = ?, body = ?, cta_label = ?, cta_href = ?, sort_order = ?, is_visible = ?
       WHERE id = ?`
    );
    this.db.exec('BEGIN');
    try {
      sections.forEach((sec, idx) => {
        upd.run(
          sec.title,
          sec.subtitle,
          sec.body,
          sec.ctaLabel,
          sec.ctaHref,
          idx + 1,
          sec.isVisible ? 1 : 0,
          sec.id
        );
      });
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return this.getSections(false);
  }

  // SETTINGS
  getSettings(): SiteSettings {
    const row = this.db
      .prepare('SELECT * FROM site_settings WHERE id = ? LIMIT 1')
      .get('global') as Record<string, unknown>;
    return {
      siteName: String(row.site_name),
      footerNote: String(row.footer_note),
      enableCppLab: Boolean(row.enable_cpp_lab),
      enableSearch: Boolean(row.enable_search),
      enableRegistration: Boolean(row.enable_registration),
    };
  }

  updateSettings(patch: Partial<SiteSettings>): SiteSettings {
    const current = this.getSettings();
    const next: SiteSettings = { ...current, ...patch };
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE site_settings
         SET site_name = ?, footer_note = ?, enable_cpp_lab = ?, enable_search = ?, enable_registration = ?, updated_at = ?
         WHERE id = 'global'`
      )
      .run(
        next.siteName,
        next.footerNote,
        next.enableCppLab ? 1 : 0,
        next.enableSearch ? 1 : 0,
        next.enableRegistration ? 1 : 0,
        now
      );
    return this.getSettings();
  }
}
