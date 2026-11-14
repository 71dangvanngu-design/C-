import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isReservedUsername,
  sanitizeRegistrationPayload,
  hasAdminAccess,
  canPerformAdminAction,
  canChangeTargetRole,
  validateAdminNewPassword,
} from './authPolicy';

test('blocks reserved ADMIN username regardless of case or whitespace', () => {
  assert.equal(isReservedUsername('ADMIN'), true);
  assert.equal(isReservedUsername('admin'), true);
  assert.equal(isReservedUsername('  AdMiN  '), true);
  assert.equal(isReservedUsername('cyber_dev'), false);

  const reg = sanitizeRegistrationPayload({
    email: 'hacker@example.com',
    username: 'admin',
    password: 'StrongPassword123',
  });
  assert.equal(reg.ok, false);
});

test('prevents self-role escalation during registration', () => {
  const reg = sanitizeRegistrationPayload({
    email: 'student@hub.dev',
    username: 'student01',
    password: 'Password123',
    role: 'admin',
  });
  assert.equal(reg.ok, true);
  if (reg.ok) {
    assert.equal(reg.forcedRole, 'user');
  }
});

test('verifies RBAC role check never relies on username alone', () => {
  assert.equal(hasAdminAccess({ role: 'user', isActive: true }), false);
  assert.equal(hasAdminAccess({ role: 'admin', isActive: false }), false);
  assert.equal(hasAdminAccess({ role: 'admin', isActive: true }), true);
});

test('blocks admin mutations while mustChangePassword is true', () => {
  const firstLogin = canPerformAdminAction({
    role: 'admin',
    isActive: true,
    mustChangePassword: true,
  });
  assert.equal(firstLogin.allowed, false);
  assert.equal(firstLogin.reason, 'PASSWORD_CHANGE_REQUIRED');

  const unlocked = canPerformAdminAction({
    role: 'admin',
    isActive: true,
    mustChangePassword: false,
  });
  assert.equal(unlocked.allowed, true);
});

test('protects primary Super Administrator from demotion and rejects default password reuse', () => {
  const actor = { id: '1', role: 'admin' as const, isActive: true };
  const adminTarget = { id: '1', username: 'ADMIN', role: 'admin' as const };
  assert.equal(canChangeTargetRole(actor, adminTarget, 'user').allowed, false);

  const reuseCheck = validateAdminNewPassword('123456789', '123456789', '123456789');
  assert.equal(reuseCheck.valid, false);

  const validUpdate = validateAdminNewPassword('CyberHub#2026!', '123456789', '123456789');
  assert.equal(validUpdate.valid, true);
});
