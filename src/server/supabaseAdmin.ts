import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedAdminClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? '';
  const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return (
    url.startsWith('https://') &&
    !url.includes('your-project.supabase.co') &&
    anonKey.length > 20 &&
    !anonKey.includes('YOUR_SUPABASE') &&
    serviceKey.length > 20 &&
    !serviceKey.includes('YOUR_SUPABASE')
  );
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return cachedAdminClient;
}

export function getSupabasePublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedPublicClient) {
    cachedPublicClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return cachedPublicClient;
}

export async function ensureSupabaseDefaultAdmin(initialPassword: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const adminEmail = 'admin@digitalknowledgehub.local';
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('username', 'ADMIN')
    .maybeSingle();

  if (existingProfile) {
    return;
  }

  const { data: usersPage, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (listError) {
    console.warn('[Supabase Admin] Failed to list users during bootstrap:', listError.message);
    return;
  }

  let adminAuthUser = usersPage.users.find(
    (u) => u.email?.toLowerCase() === adminEmail || u.user_metadata?.username === 'ADMIN'
  );

  if (!adminAuthUser) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: initialPassword,
      email_confirm: true,
      user_metadata: {
        username: 'ADMIN',
        account_type: 'Super Administrator',
      },
    });
    if (createError || !created.user) {
      console.warn('[Supabase Admin] Failed to create default ADMIN user:', createError?.message);
      return;
    }
    adminAuthUser = created.user;
  }

  await admin.from('profiles').upsert({
    id: adminAuthUser.id,
    username: 'ADMIN',
    email: adminEmail,
    role: 'admin',
    account_type: 'Super Administrator',
    must_change_password: true,
    is_active: true,
  });
}
