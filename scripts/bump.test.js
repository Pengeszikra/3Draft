import test from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion, display } from './bump.js';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const nov1 = new Date(2026, 10, 1);

test('first build of a day', () => {
  assert.equal(nextVersion('0.1.0', nov1), '26.11.1001');
});

test('further builds on the same day count up', () => {
  assert.equal(nextVersion('26.11.1001', nov1), '26.11.1002');
  assert.equal(nextVersion('26.11.1009', nov1), '26.11.1010');
});

test('a new day or month starts again at build 1', () => {
  assert.equal(nextVersion('26.11.1002', new Date(2026, 10, 2)), '26.11.2001');
  assert.equal(nextVersion('26.11.30005', new Date(2026, 11, 1)), '26.12.1001');
  assert.equal(nextVersion('26.12.31003', new Date(2027, 0, 1)), '27.1.1001');
});

test('results are valid semver (no leading zeros, three parts)', () => {
  for (const d of [nov1, new Date(2026, 4, 5), new Date(2027, 0, 31)]) {
    assert.match(nextVersion('0.0.1', d), SEMVER);
  }
});

test('display gives the readable YY.MM.DD.NNN form', () => {
  assert.equal(display('26.11.1001'), '26.11.01.001');
  assert.equal(display('26.11.15012'), '26.11.15.012');
  assert.equal(display('27.1.31999'), '27.01.31.999');
});

test('more than 999 builds in a day is an error', () => {
  assert.throws(() => nextVersion('26.11.1999', nov1), /999/);
});
