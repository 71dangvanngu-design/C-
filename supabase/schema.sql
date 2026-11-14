-- =============================================================================
-- DIGITAL KNOWLEDGE HUB — COMPLETE SUPABASE POSTGRESQL SCHEMA + RLS + SEED SQL
-- Run this script directly in the Supabase SQL Editor to provision all tables,
-- indexes, auth triggers, Row-Level Security policies, and initial content.
--
-- SECURITY NOTICE:
-- No plaintext passwords or ADMIN credentials exist in this SQL file.
-- The default Super Administrator (Username: ADMIN) is provisioned securely
-- at runtime by the backend server using SUPABASE_SERVICE_ROLE_KEY.
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. PROFILES
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  account_type text not null default 'Standard User' check (account_type in ('Standard User', 'Super Administrator')),
  must_change_password boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_username_lower on public.profiles (lower(username));
create index if not exists idx_profiles_email_lower on public.profiles (lower(email));
create index if not exists idx_profiles_role on public.profiles (role);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.prevent_reserved_username_or_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if upper(trim(new.username)) = 'ADMIN' and auth.uid() is not null then
      raise exception 'Username ADMIN is reserved by the system.';
    end if;
    if auth.uid() is not null then
      new.role := 'user';
      new.account_type := 'Standard User';
      new.must_change_password := false;
    end if;
  elsif tg_op = 'UPDATE' then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
    ) then
      if new.role <> old.role or new.account_type <> old.account_type then
        raise exception 'Privilege escalation is strictly prohibited.';
      end if;
      if upper(trim(new.username)) = 'ADMIN' and upper(trim(old.username)) <> 'ADMIN' then
        raise exception 'Username ADMIN is reserved by the system.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
before insert or update on public.profiles
for each row execute function public.prevent_reserved_username_or_escalation();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    split_part(new.email, '@', 1)
  );

  if upper(trim(requested_username)) = 'ADMIN'
     and coalesce(new.raw_user_meta_data ->> 'account_type', '') <> 'Super Administrator' then
    raise exception 'Username ADMIN cannot be registered.';
  end if;

  insert into public.profiles (id, username, email, role, account_type, must_change_password, is_active)
  values (
    new.id,
    requested_username,
    lower(new.email),
    'user',
    'Standard User',
    false,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. CATEGORIES, LESSONS, HEADER TABS, SECTIONS, SETTINGS
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null,
  content text not null,
  cpp_starter text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  level text not null default 'Intermediate' check (level in ('Beginner', 'Intermediate', 'Advanced')),
  read_minutes integer not null default 8 check (read_minutes >= 1),
  image_url text not null default '',
  status text not null default 'draft' check (status in ('published', 'hidden', 'draft')),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lessons_status on public.lessons (status);
create index if not exists idx_lessons_category on public.lessons (category_id);

drop trigger if exists trg_lessons_updated_at on public.lessons;
create trigger trg_lessons_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create table if not exists public.header_tabs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true
);

create index if not exists idx_header_tabs_order on public.header_tabs (sort_order);

create table if not exists public.site_sections (
  id text primary key,
  section_type text not null,
  title text not null,
  subtitle text not null default '',
  body text not null default '',
  cta_label text not null default '',
  cta_href text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true
);

create index if not exists idx_site_sections_order on public.site_sections (sort_order);

create table if not exists public.site_settings (
  id text primary key default 'global',
  site_name text not null default 'DIGITAL KNOWLEDGE HUB',
  footer_note text not null default 'DIGITAL KNOWLEDGE HUB · Systems & C++ Engineering Curriculum',
  enable_cpp_lab boolean not null default true,
  enable_search boolean not null default true,
  enable_registration boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY POLICIES
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.lessons enable row level security;
alter table public.header_tabs enable row level security;
alter table public.site_sections enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can update own non-privileged profile fields" on public.profiles;
create policy "Users can update own non-privileged profile fields"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (
    public.is_admin()
    or (
      auth.uid() = id
      and role = 'user'
      and account_type = 'Standard User'
      and upper(trim(username)) <> 'ADMIN'
    )
  );

drop policy if exists "Only admins can delete profiles" on public.profiles;
create policy "Only admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories"
  on public.categories for select
  using (true);

drop policy if exists "Admin write categories" on public.categories;
create policy "Admin write categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read published lessons" on public.lessons;
create policy "Public read published lessons"
  on public.lessons for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Admin manage all lessons" on public.lessons;
create policy "Admin manage all lessons"
  on public.lessons for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read visible header tabs" on public.header_tabs;
create policy "Public read visible header tabs"
  on public.header_tabs for select
  using (is_visible = true or public.is_admin());

drop policy if exists "Admin manage header tabs" on public.header_tabs;
create policy "Admin manage header tabs"
  on public.header_tabs for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read visible sections" on public.site_sections;
create policy "Public read visible sections"
  on public.site_sections for select
  using (is_visible = true or public.is_admin());

drop policy if exists "Admin manage sections" on public.site_sections;
create policy "Admin manage sections"
  on public.site_sections for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings"
  on public.site_settings for select
  using (true);

drop policy if exists "Admin update site settings" on public.site_settings;
create policy "Admin update site settings"
  on public.site_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. INITIAL CONTENT SEED
-- -----------------------------------------------------------------------------
insert into public.categories (id, name, slug, description)
values
  ('11111111-1111-4111-8111-111111111101', 'Systems & C++', 'systems-cpp', 'Memory layout, pointers, deterministic containers, and systems performance.'),
  ('11111111-1111-4111-8111-111111111102', 'Algorithms & Graphs', 'algorithms-graphs', 'Binary search, graph traversal, and asymptotic complexity analysis.'),
  ('11111111-1111-4111-8111-111111111103', 'Security & Architecture', 'security-architecture', 'Zero-trust access control, cryptographic hashing, and Row-Level Security.')
on conflict (slug) do nothing;

insert into public.lessons (id, title, slug, summary, content, cpp_starter, category_id, level, read_minutes, image_url, status)
values
  (
    '22222222-2222-4222-8222-222222222201',
    'Contiguous Memory & Vector Allocation in Modern C++',
    'contiguous-memory-vector-allocation',
    'Explore how stack frames, heap buffers, and std::vector stride alignment affect CPU cache locality.',
    E'Modern processors fetch memory in 64-byte cache lines rather than isolated bytes. When elements live contiguously inside std::vector, sequential iteration hits L1 cache predictably.\n\nKey Architectural Principles:\n1. Stack frames allocate fixed-size primitives in O(1) via stack pointer decrement.\n2. Heap buffers managed by RAII wrappers prevent leaked descriptors across exception boundaries.\n3. Reserving capacity upfront avoids geometric reallocation copies during hot loops.',
    E'#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> blocks = {64, 128, 256, 512};\n    int total = 0;\n\n    for (int i = 0; i < blocks.size(); i++) {\n        total += blocks[i];\n        cout << "Segment[" << i << "] = " << blocks[i] << " KB" << endl;\n    }\n\n    cout << "Total Allocated: " << total << " KB" << endl;\n    return 0;\n}',
    (select id from public.categories where slug = 'systems-cpp' limit 1),
    'Intermediate',
    9,
    '/src/assets/images/lesson_cpp_memory_1794627186736.jpg',
    'published'
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    'Deterministic Binary Search & Loop Invariants',
    'deterministic-binary-search-invariants',
    'Prove termination bounds and eliminate off-by-one defects in logarithmic search partitions.',
    E'Binary search narrows a monotonic search space by half on every comparison. Correctness depends on maintaining strict boundary invariants between left and right cursors.\n\nInvariant Specification:\n- Closed interval [left, right] always encloses any valid target index.\n- Midpoint calculation divides the remaining distance without overflow.\n- Termination occurs cleanly when left > right.',
    E'#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> nums = {4, 11, 19, 27, 42, 58, 73, 91};\n    int target;\n    cin >> target;\n\n    int left = 0;\n    int right = nums.size() - 1;\n    int found = -1;\n\n    while (left <= right) {\n        int mid = (left + right) / 2;\n        if (nums[mid] == target) {\n            found = mid;\n            left = right + 1;\n        } else if (nums[mid] < target) {\n            left = mid + 1;\n        } else {\n            right = mid - 1;\n        }\n    }\n\n    if (found != -1) {\n        cout << "Target " << target << " located at index " << found << endl;\n    } else {\n        cout << "Target " << target << " not found in buffer" << endl;\n    }\n    return 0;\n}',
    (select id from public.categories where slug = 'algorithms-graphs' limit 1),
    'Beginner',
    7,
    '/src/assets/images/lesson_algorithms_graph_1794627186970.jpg',
    'published'
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    'Zero-Trust RBAC & Row-Level Security Patterns',
    'zero-trust-rbac-row-level-security',
    'Enforce role separation in database policies and backend middleware without trusting client claims.',
    E'Relying solely on client-side route guards or mutable usernames leaves administrative endpoints exposed. Production systems verify cryptographic session identity and evaluate authoritative role tables on every privileged call.\n\nDefense Checklist:\n1. Store passwords exclusively as salted cryptographic hashes (scrypt / Argon2 / Supabase Auth).\n2. Keep service-role keys strictly on the backend server environment.\n3. Force immediate rotation of bootstrap credentials on first administrator sign-in.\n4. Enforce database-level RLS policies so standard users cannot elevate their own role.',
    E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int roleLevel = 1;\n    int requiredLevel = 2;\n\n    if (roleLevel >= requiredLevel) {\n        cout << "ACCESS GRANTED: ADMIN CONTROL PANEL" << endl;\n    } else {\n        cout << "ACCESS DENIED: INSUFFICIENT ROLE" << endl;\n    }\n    return 0;\n}',
    (select id from public.categories where slug = 'security-architecture' limit 1),
    'Advanced',
    11,
    '/src/assets/images/hero_cyber_knowledge_hub_1794627187265.jpg',
    'published'
  )
on conflict (slug) do nothing;

insert into public.header_tabs (id, label, href, sort_order, is_visible)
values
  ('33333333-3333-4333-8333-333333333301', 'Overview', '/', 1, true),
  ('33333333-3333-4333-8333-333333333302', 'Lessons', '/#catalog', 2, true),
  ('33333333-3333-4333-8333-333333333303', 'C++ Code Lab', '/cpp-lab', 3, true),
  ('33333333-3333-4333-8333-333333333304', 'Security', '/#architecture', 4, true)
on conflict (id) do nothing;

insert into public.site_sections (id, section_type, title, subtitle, body, cta_label, cta_href, sort_order, is_visible)
values
  ('sec-hero', 'hero', 'Systems Engineering & C++ Mastery', 'DIGITAL KNOWLEDGE HUB', 'Structured technical curriculum covering memory architecture, algorithmic invariants, and zero-trust security paired with an interactive C++ execution sandbox.', 'Open C++ Code Lab', '/cpp-lab', 1, true),
  ('sec-catalog', 'catalog', 'Published Curriculum Modules', 'Technical Library', 'Browse verified systems programming, graph algorithms, and security engineering lessons.', 'Launch Sandbox', '/cpp-lab', 2, true),
  ('sec-cpplab', 'cpp_lab_promo', 'Interactive C++ Code Lab', 'Execution Sandbox', 'Write, test, and trace C++ loops, vectors, and standard input streams directly in the browser.', 'Launch C++ Code Lab', '/cpp-lab', 3, true),
  ('sec-arch', 'architecture', 'Role-Based Access & Supabase Auth Architecture', 'Platform Governance', 'Protected by server-side admin verification, salted credential hashing, reserved ADMIN bootstrap controls, and strict Row-Level Security policies.', 'Account Portal', '/login', 4, true)
on conflict (id) do nothing;

insert into public.site_settings (id, site_name, footer_note, enable_cpp_lab, enable_search, enable_registration)
values
  ('global', 'DIGITAL KNOWLEDGE HUB', 'DIGITAL KNOWLEDGE HUB · Systems Engineering & C++ Curriculum', true, true, true)
on conflict (id) do nothing;
