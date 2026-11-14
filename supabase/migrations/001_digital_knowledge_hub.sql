-- DIGITAL KNOWLEDGE HUB: Supabase PostgreSQL Schema, Triggers & Row-Level Security (RLS)
-- NOTE: No plaintext credentials or hardcoded admin passwords are stored in SQL.
-- Default Super Administrator (Username: ADMIN) is provisioned securely via backend
-- Supabase Admin API using SUPABASE_SERVICE_ROLE_KEY.

create extension if not exists "pgcrypto";

-- Shared updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. PROFILES TABLE (Linked 1-to-1 with auth.users)
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

-- Enforce reserved username protection & block self-escalation on profile updates
create or replace function public.prevent_reserved_username_or_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Only allow ADMIN username creation when provisioned by service_role (auth.uid() is null)
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

-- Automatically provision a Standard User profile when a user signs up via Supabase Auth
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

  -- Service-role admin creation populates profiles explicitly; block reserved ADMIN from client signups
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

-- Helper function checking admin role from profiles (never by username alone)
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

-- 2. CATEGORIES
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

-- 3. LESSONS
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

-- 4. HEADER TABS
create table if not exists public.header_tabs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true
);

create index if not exists idx_header_tabs_order on public.header_tabs (sort_order);

-- 5. HOMEPAGE SECTIONS
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

-- 6. SITE SETTINGS & COMPONENTS
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

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.lessons enable row level security;
alter table public.header_tabs enable row level security;
alter table public.site_sections enable row level security;
alter table public.site_settings enable row level security;

-- RLS POLICIES: PROFILES
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

-- RLS POLICIES: CATEGORIES
drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories"
  on public.categories for select
  using (true);

drop policy if exists "Admin write categories" on public.categories;
create policy "Admin write categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- RLS POLICIES: LESSONS
drop policy if exists "Public read published lessons" on public.lessons;
create policy "Public read published lessons"
  on public.lessons for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Admin manage all lessons" on public.lessons;
create policy "Admin manage all lessons"
  on public.lessons for all
  using (public.is_admin())
  with check (public.is_admin());

-- RLS POLICIES: HEADER TABS, SECTIONS, SETTINGS
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
