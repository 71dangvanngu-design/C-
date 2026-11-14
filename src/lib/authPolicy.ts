import type { UserProfile, UserRole } from '../types/hub';

export const RESERVED_ADMIN_USERNAME = 'ADMIN';
export const GENERIC_LOGIN_FAILED_MESSAGE = 'LOGIN FAILED';
export const PASSWORD_CHANGE_REQUIRED_CODE = 'PASSWORD_CHANGE_REQUIRED';

export function normalizeUsername(input: string): string {
  return input.trim();
}

export function isReservedUsername(username: string): boolean {
  return username.trim().toUpperCase() === RESERVED_ADMIN_USERNAME;
}

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function validateUsernameFormat(username: string): { valid: boolean; error?: string } {
  const cleaned = normalizeUsername(username);
  if (cleaned.length < 3 || cleaned.length > 32) {
    return { valid: false, error: 'Username must be between 3 and 32 characters.' };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleaned)) {
    return { valid: false, error: 'Username may only contain letters, numbers, underscores, dots, or hyphens.' };
  }
  if (isReservedUsername(cleaned)) {
    return { valid: false, error: 'This username is reserved by the system.' };
  }
  return { valid: true };
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password must be 128 characters or fewer.' };
  }
  return { valid: true };
}

export function validateAdminNewPassword(
  newPassword: string,
  currentPassword: string,
  disallowedInitialPassword?: string
): { valid: boolean; error?: string } {
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) return strength;

  if (newPassword === currentPassword) {
    return { valid: false, error: 'New password must be different from your current password.' };
  }
  if (disallowedInitialPassword && newPassword === disallowedInitialPassword) {
    return { valid: false, error: 'You cannot reuse the initial default password.' };
  }
  return { valid: true };
}

export function sanitizeRegistrationPayload(input: {
  email?: string;
  username?: string;
  password?: string;
  role?: string;
}):
  | { ok: true; email: string; username: string; password: string; forcedRole: 'user' }
  | { ok: false; error: string } {
  const email = (input.email ?? '').trim().toLowerCase();
  const username = normalizeUsername(input.username ?? '');
  const password = input.password ?? '';

  if (!isValidEmail(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  const usernameCheck = validateUsernameFormat(username);
  if (!usernameCheck.valid) {
    return { ok: false, error: usernameCheck.error! };
  }

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.valid) {
    return { ok: false, error: passwordCheck.error! };
  }

  // Always force 'user' role regardless of any client-supplied role parameter
  return {
    ok: true,
    email,
    username,
    password,
    forcedRole: 'user',
  };
}

export function hasAdminAccess(profile: Pick<UserProfile, 'role' | 'isActive'> | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'admin' && profile.isActive === true;
}

export function canPerformAdminAction(
  profile: Pick<UserProfile, 'role' | 'isActive' | 'mustChangePassword'> | null | undefined
): { allowed: boolean; reason?: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'PASSWORD_CHANGE_REQUIRED' } {
  if (!profile) return { allowed: false, reason: 'UNAUTHENTICATED' };
  if (!hasAdminAccess(profile)) return { allowed: false, reason: 'FORBIDDEN' };
  if (profile.mustChangePassword) return { allowed: false, reason: 'PASSWORD_CHANGE_REQUIRED' };
  return { allowed: true };
}

export function canChangeTargetRole(
  actor: Pick<UserProfile, 'id' | 'role' | 'isActive'>,
  target: Pick<UserProfile, 'id' | 'username' | 'role'>,
  nextRole: UserRole
): { allowed: boolean; error?: string } {
  if (!hasAdminAccess(actor)) {
    return { allowed: false, error: 'Only administrators can modify user roles.' };
  }
  if (isReservedUsername(target.username) && nextRole !== 'admin') {
    return { allowed: false, error: 'The primary Super Administrator account cannot be demoted.' };
  }
  if (actor.id === target.id && nextRole !== 'admin') {
    return { allowed: false, error: 'Administrators cannot remove their own admin role.' };
  }
  return { allowed: true };
}
