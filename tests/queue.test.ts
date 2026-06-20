import test from 'node:test';
import assert from 'node:assert/strict';
import { safeProviderErrorCode, sortQueuedJobsForDisplay } from '../src/lib/queue';

test('keeps normal fifo order when no priority jobs exist', () => {
  const sorted = sortQueuedJobsForDisplay(
    [
      { id: 'b', isPriority: false, createdAt: '2026-06-13T00:00:02.000Z' },
      { id: 'a', isPriority: false, createdAt: '2026-06-13T00:00:01.000Z' },
    ],
    50,
  );

  assert.deepEqual(
    sorted.map((job) => job.id),
    ['a', 'b'],
  );
});

test('places priority jobs after protected concurrency window', () => {
  const sorted = sortQueuedJobsForDisplay(
    [
      { id: 'n1', isPriority: false, createdAt: '2026-06-13T00:00:01.000Z' },
      { id: 'n2', isPriority: false, createdAt: '2026-06-13T00:00:02.000Z' },
      { id: 'n3', isPriority: false, createdAt: '2026-06-13T00:00:03.000Z' },
      { id: 'p1', isPriority: true, createdAt: '2026-06-13T00:00:04.000Z' },
      { id: 'p2', isPriority: true, createdAt: '2026-06-13T00:00:05.000Z' },
    ],
    2,
  );

  assert.deepEqual(
    sorted.map((job) => job.id),
    ['n1', 'n2', 'p1', 'p2', 'n3'],
  );
});

test('does not allow priority jobs inside the configured protected window', () => {
  const jobs = Array.from({ length: 55 }, (_, index) => ({
    id: `n${index + 1}`,
    isPriority: false,
    createdAt: `2026-06-13T00:00:${String(index + 1).padStart(2, '0')}.000Z`,
  }));

  jobs.push({
    id: 'priority',
    isPriority: true,
    createdAt: '2026-06-13T00:01:00.000Z',
  });

  const sorted = sortQueuedJobsForDisplay(jobs, 50);

  assert.equal(sorted[49].id, 'n50');
  assert.equal(sorted[50].id, 'priority');
  assert.equal(sorted[51].id, 'n51');
});

test('normalizes provider error codes for diagnostics', () => {
  assert.equal(safeProviderErrorCode(new Error('Rate limit exceeded')), 'rate_limit_exceeded');
  assert.equal(safeProviderErrorCode(new Error('provider_http_429')), 'provider_http_429');
  assert.equal(safeProviderErrorCode(new Error('')), 'provider_failed');
});
