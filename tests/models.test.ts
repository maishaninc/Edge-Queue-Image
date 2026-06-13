import test from 'node:test';
import assert from 'node:assert/strict';
import { inferModelIcon, parseModelConfigs } from '../src/lib/models';

test('parses default and numbered model groups', () => {
  const models = parseModelConfigs({
    MODEL: 'gpt-image-1',
    KEY: 'key-default',
    API: 'https://api.openai.com/',
    MODEL_1: 'vendor-model',
    KEY_1: 'key-1',
    API_1: 'https://example.com///',
  });

  assert.deepEqual(models, [
    {
      id: 'default',
      name: 'gpt-image-1',
      key: 'key-default',
      api: 'https://api.openai.com',
    },
    {
      id: '1',
      name: 'vendor-model',
      key: 'key-1',
      api: 'https://example.com',
    },
  ]);
});

test('skips incomplete model groups', () => {
  const models = parseModelConfigs({
    MODEL: 'gpt-image-1',
    KEY: '',
    API: 'https://api.openai.com',
    MODEL_1: 'vendor-model',
    KEY_1: 'key-1',
  });

  assert.deepEqual(models, []);
});

test('infers public model icons from names', () => {
  assert.equal(inferModelIcon('gpt-image-1'), 'openai');
  assert.equal(inferModelIcon('FLUX.1 Kontext'), 'flux');
  assert.equal(inferModelIcon('seedream-v3'), 'seedream');
  assert.equal(inferModelIcon('gemini imagen'), 'google');
  assert.equal(inferModelIcon('stable-diffusion-xl'), 'stable');
  assert.equal(inferModelIcon('custom-model'), 'model');
});
