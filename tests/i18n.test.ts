import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  LANGUAGE_LABELS,
  LOCALES,
  isSiteLocale,
  localeFromPathname,
  relativeLanguageAlternates,
} from '../src/lib/i18n';

test('supports four public locales with English as default', () => {
  assert.deepEqual([...LOCALES], ['en-US', 'zh-CN', 'zh-TW', 'ja']);
  assert.equal(DEFAULT_LOCALE, 'en-US');
  assert.equal(LANGUAGE_LABELS['en-US'], 'English');
  assert.equal(LANGUAGE_LABELS['zh-CN'], '简体中文');
  assert.equal(LANGUAGE_LABELS['zh-TW'], '繁體中文');
  assert.equal(LANGUAGE_LABELS.ja, '日本語');
});

test('detects locale from pathname', () => {
  assert.equal(isSiteLocale('zh-TW'), true);
  assert.equal(isSiteLocale('fr'), false);
  assert.equal(localeFromPathname('/ja'), 'ja');
  assert.equal(localeFromPathname('/zh-CN?x=1'), DEFAULT_LOCALE);
  assert.equal(localeFromPathname('/missing'), DEFAULT_LOCALE);
});

test('returns relative language alternates', () => {
  assert.deepEqual(relativeLanguageAlternates(), {
    'en-US': '/en-US',
    'zh-CN': '/zh-CN',
    'zh-TW': '/zh-TW',
    ja: '/ja',
    'x-default': '/',
  });
});
