import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSession, verifyAdminPassword, verifyAdminSession } from '../src/lib/admin-auth';

function withAdminEnv(run: () => void) {
  const previous = {
    ADMIN_PATH: process.env.ADMIN_PATH,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  };

  process.env.ADMIN_PATH = '/aivroadmin';
  process.env.ADMIN_PASSWORD = 'strong-password';
  process.env.ADMIN_SESSION_SECRET = 'session-secret';

  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('verifies admin password using configured bootstrap env', () => {
  withAdminEnv(() => {
    assert.equal(verifyAdminPassword('strong-password'), true);
    assert.equal(verifyAdminPassword('wrong-password'), false);
  });
});

test('signs, verifies, and expires admin sessions', () => {
  withAdminEnv(() => {
    const issuedAt = Date.UTC(2026, 0, 1);
    const token = createAdminSession(issuedAt);

    assert.equal(verifyAdminSession(token, issuedAt + 1000), true);
    assert.equal(verifyAdminSession(`${token}x`, issuedAt + 1000), false);
    assert.equal(verifyAdminSession(token, issuedAt + 8 * 24 * 60 * 60 * 1000), false);
  });
});
