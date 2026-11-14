import test from 'node:test';
import assert from 'node:assert/strict';
import { executeCppSimulation, CPP_LAB_PRESETS } from './cppRunner';

test('executes vector loop preset and produces expected stdout', () => {
  const preset = CPP_LAB_PRESETS[0];
  const res = executeCppSimulation(preset.code, preset.stdin);
  assert.equal(res.success, true);
  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /Total Allocated: 960 KB/);
});

test('executes binary search preset using stdin target', () => {
  const preset = CPP_LAB_PRESETS[1];
  const res = executeCppSimulation(preset.code, '42');
  assert.equal(res.success, true);
  assert.match(res.stdout, /Target 42 located at index 4/);
});

test('reports compile error when main() is missing', () => {
  const res = executeCppSimulation('int foo() { return 1; }');
  assert.equal(res.success, false);
  assert.match(res.stderr, /missing entry point/i);
});
