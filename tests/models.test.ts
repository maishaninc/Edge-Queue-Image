import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelConfigs } from '../src/lib/models';

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
