import test from 'node:test';
import assert from 'node:assert/strict';
import { areImageOptionsValid, normalizeImageOptions } from '../src/lib/image-options';

test('maps quality and aspect ratio to provider size', () => {
  assert.equal(normalizeImageOptions({ quality: '1K', aspectRatio: '1:1' }).size, '1024x1024');
  assert.equal(normalizeImageOptions({ quality: '2K', aspectRatio: '16:9' }).size, '2048x1152');
  assert.equal(normalizeImageOptions({ quality: '4K', aspectRatio: '9:16' }).size, '2304x4096');
});

test('defaults missing image options but rejects invalid explicit values', () => {
  assert.deepEqual(normalizeImageOptions({}), {
    quality: '1K',
    aspectRatio: '1:1',
    size: '1024x1024',
  });

  assert.equal(areImageOptionsValid({}), true);
  assert.equal(areImageOptionsValid({ quality: '8K' }), false);
  assert.equal(areImageOptionsValid({ aspectRatio: '2:1' }), false);
});
