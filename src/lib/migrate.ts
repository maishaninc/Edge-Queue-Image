import "server-only";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import { hashPassword } from "@/lib/password";
import {
  DEFAULT_PRIVATE_SETTINGS,
  DEFAULT_PUBLIC_SETTINGS,
} from "@/lib/settings-defaults";

/**
 * Idempotent schema creation + seeding. Safe to run on every cold start.
 * - Creates all tables / indexes with IF NOT EXISTS.
 * - Seeds `public` / `private` settings rows only if absent (never clobbers admin edits).
 * - Creates the default admin (admin / admin, forced password change) only if no admin exists.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      username text UNIQUE NOT NULL,
      email text,
      display_name text,
      avatar_url text,
      role text NOT NULL DEFAULT 'user',
      status text NOT NULL DEFAULT 'active',
      auth_provider text NOT NULL DEFAULT 'password',
      google_id text UNIQUE,
      github_id text UNIQUE,
      password_hash text,
      must_change_password boolean NOT NULL DEFAULT false,
      email_verified boolean NOT NULL DEFAULT false,
      credits int NOT NULL DEFAULT 0,
      last_check_in_date date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_login_at timestamptz
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS credits int NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_check_in_date date;

    CREATE TABLE IF NOT EXISTS sessions (
      token text PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      ip text PRIMARY KEY,
      fails int NOT NULL DEFAULT 0,
      locked_until timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS generation_histories (
      id text PRIMARY KEY,
      user_id text REFERENCES users(id) ON DELETE SET NULL,
      type text NOT NULL DEFAULT 'image',
      title text,
      prompt text,
      model text,
      config jsonb,
      status text,
      error text,
      duration_ms bigint,
      success_count int NOT NULL DEFAULT 0,
      fail_count int NOT NULL DEFAULT 0,
      image_count int NOT NULL DEFAULT 0,
      size text,
      quality text,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS gen_hist_user_idx ON generation_histories(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS gen_hist_expires_idx ON generation_histories(expires_at);

    CREATE TABLE IF NOT EXISTS generation_images (
      id text PRIMARY KEY,
      history_id text REFERENCES generation_histories(id) ON DELETE CASCADE,
      user_id text REFERENCES users(id) ON DELETE SET NULL,
      prompt text,
      model text,
      data bytea,
      mime_type text,
      width int,
      height int,
      bytes int,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS gen_img_history_idx ON generation_images(history_id);
    CREATE INDEX IF NOT EXISTS gen_img_user_idx ON generation_images(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS gen_img_expires_idx ON generation_images(expires_at);

    CREATE TABLE IF NOT EXISTS generation_jobs (
      id text PRIMARY KEY,
      user_id text REFERENCES users(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'queued',
      model text,
      prompt text,
      request jsonb,
      queue_position int,
      history_id text,
      result_image_id text,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      started_at timestamptz,
      finished_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS gen_jobs_status_idx ON generation_jobs(status, created_at);
    CREATE INDEX IF NOT EXISTS gen_jobs_user_idx ON generation_jobs(user_id, created_at DESC);
  `);

  // Seed settings rows (only when missing).
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('public', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_PUBLIC_SETTINGS)],
  );
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('private', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(DEFAULT_PRIVATE_SETTINGS)],
  );

  // Bootstrap / sync the admin account from env (ADMIN_USERNAME + ADMIN_PASSWORD).
  // Env stays authoritative across redeploys; if no password is provided we fall
  // back to admin/admin with a forced first-login change.
  const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim() || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const hasEnvPassword = adminPassword.length > 0;
  const existingAdmin = await pool.query("SELECT id FROM users WHERE username = $1", [adminUsername]);
  if (existingAdmin.rows[0]) {
    if (hasEnvPassword) {
      await pool.query(
        `UPDATE users SET password_hash = $1, role = 'admin', status = 'active',
           must_change_password = false, updated_at = now() WHERE id = $2`,
        [hashPassword(adminPassword), existingAdmin.rows[0].id],
      );
    }
  } else {
    await pool.query(
      `INSERT INTO users (id, username, display_name, role, status, auth_provider, password_hash, must_change_password, email_verified)
       VALUES ($1, $2, '管理员', 'admin', 'active', 'password', $3, $4, true)`,
      [randomUUID(), adminUsername, hashPassword(hasEnvPassword ? adminPassword : "admin"), !hasEnvPassword],
    );
  }
}
