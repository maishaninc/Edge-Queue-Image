import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminLoginLocked, isJobRateLimited } from '../src/lib/security';

test('locks admin login after repeated failures in the window', () => {
  const now = Date.UTC(2026, 0, 1);
  assert.equal(isAdminLoginLocked({ failedCount: 4, lastFailedAt: new Date(now).toISOString() }, now), false);
  assert.equal(isAdminLoginLocked({ failedCount: 5, lastFailedAt: new Date(now).toISOString() }, now), true);
  assert.equal(isAdminLoginLocked({ failedCount: 5, lastFailedAt: new Date(now - 16 * 60 * 1000).toISOString() }, now), false);
});

test('limits public job submissions inside a rolling window', () => {
  const now = Date.UTC(2026, 0, 1);
  const recent = Array.from({ length: 10 }, (_, index) => new Date(now - index * 1000).toISOString());
  const old = Array.from({ length: 10 }, (_, index) => new Date(now - 20 * 60 * 1000 - index * 1000).toISOString());

  assert.equal(isJobRateLimited(recent, now), true);
  assert.equal(isJobRateLimited(old, now), false);
});
