-- 002: Decouple email from identity.
-- Make users.email OPTIONAL + NON-UNIQUE so staff can share an inbox (e.g. rd@nosetea.com),
-- use a personal @gmail, or have no email at all. Identity stays on line_user_id + employee code.
-- SQLite can't drop a column constraint in place, so we rebuild the table (data preserved).
-- Run ONCE:  npx wrangler d1 execute nose-tea-onboarding --remote --file=./migrations/002_email_optional.sql
-- (Take a backup first — D1 Time Travel covers the last 30 days, or `wrangler d1 export`.)

PRAGMA defer_foreign_keys = TRUE;

CREATE TABLE users_new (
  user_id TEXT PRIMARY KEY,
  line_user_id TEXT UNIQUE,
  display_name TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  position TEXT,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  employee_id TEXT
);

INSERT INTO users_new (user_id, line_user_id, display_name, name, role, department, position, email, active, created_at, updated_at, last_login_at, employee_id)
SELECT user_id, line_user_id, display_name, name, role, department, position, email, active, created_at, updated_at, last_login_at, employee_id
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
