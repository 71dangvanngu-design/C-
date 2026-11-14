import test from 'node:test';
import assert from 'node:assert/strict';
import { HubSqlDatabase, verifyPasswordHash } from './sqlDb';

test('seeds ADMIN with scrypt-hashed password and never stores plaintext', () => {
  const db = new HubSqlDatabase(':memory:');
  const admin = db.findUserByIdentifier('ADMIN');
  assert.ok(admin);
  assert.equal(admin.role, 'admin');
  assert.equal(admin.accountType, 'Super Administrator');
  assert.equal(admin.mustChangePassword, true);
  assert.notEqual(admin.passwordHash, '123456789');
  assert.equal(verifyPasswordHash('123456789', admin.passwordHash, admin.passwordSalt), true);
});

test('supports SQL CRUD for categories, lessons, and header tab ordering', () => {
  const db = new HubSqlDatabase(':memory:');
  const admin = db.findUserByIdentifier('ADMIN')!;

  const cat = db.createCategory('Compilers', 'AST and IR lowering');
  const lesson = db.createLesson(admin.id, {
    title: 'SSA Form Optimization',
    summary: 'Static Single Assignment passes in LLVM.',
    content: 'Full SSA breakdown.',
    categoryId: cat.id,
    status: 'published',
  });

  assert.equal(db.getLessonBySlug(lesson.slug, false)?.title, 'SSA Form Optimization');

  db.updateLesson(lesson.id, { status: 'hidden' });
  assert.equal(db.getLessonBySlug(lesson.slug, false), null);
  assert.equal(db.getLessonBySlug(lesson.slug, true)?.status, 'hidden');

  const tabs = db.getHeaderTabs(false);
  const reversed = [...tabs].reverse().map((t) => t.id);
  const reordered = db.reorderHeaderTabs(reversed);
  assert.equal(reordered[0].id, reversed[0]);
});
