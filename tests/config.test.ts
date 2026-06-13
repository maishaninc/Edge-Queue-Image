import test from 'node:test';
import assert from 'node:assert/strict';
import { getQueueConfig } from '../src/lib/config';

test('parses job result ttl with default and minimum', () => {
  const previous = process.env.JOB_RESULT_TTL_MINUTES;

  delete process.env.JOB_RESULT_TTL_MINUTES;
  assert.equal(getQueueConfig().jobResultTtlMinutes, 15);

  process.env.JOB_RESULT_TTL_MINUTES = '30';
  assert.equal(getQueueConfig().jobResultTtlMinutes, 30);

  process.env.JOB_RESULT_TTL_MINUTES = '0';
  assert.equal(getQueueConfig().jobResultTtlMinutes, 15);

  if (previous === undefined) {
    delete process.env.JOB_RESULT_TTL_MINUTES;
  } else {
    process.env.JOB_RESULT_TTL_MINUTES = previous;
  }
});
