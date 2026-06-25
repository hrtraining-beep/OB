-- Migration 001: Employee CSV import + LIFF binding + future probation support.
-- Cloudflare D1 compatible SQL.
-- Run once against the existing production D1 database.
--
-- Why the employees table is rebuilt:
-- The existing employees.user_id column is NOT NULL, but HR employee master data
-- must be importable before an employee opens LIFF. SQLite/D1 cannot reliably
-- drop a NOT NULL constraint in place, so this migration creates a new table,
-- copies data, drops the old table, and renames the new table.

PRAGMA foreign_keys = off;

-- Add users.employee_id so a LINE user account can link back to employee master data.
ALTER TABLE users ADD COLUMN employee_id TEXT;

-- Add reminder tracking fields to the existing tasks table.
ALTER TABLE tasks ADD COLUMN last_reminder_at TEXT;
ALTER TABLE tasks ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN reminder_policy TEXT DEFAULT 'repeat_until_submitted';

-- Rebuild employees with nullable user_id and future-ready employee master fields.
CREATE TABLE employees_v1 (
  employee_id TEXT PRIMARY KEY,

  -- Nullable because HR imports employees before LINE registration.
  user_id TEXT,

  -- Stable HR employee code used for CSV upsert and LIFF binding.
  employee_code TEXT UNIQUE,

  employee_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  branch TEXT,
  start_date TEXT,
  employment_status TEXT DEFAULT 'active',
  created_source TEXT DEFAULT 'manual',

  -- Existing onboarding fields.
  current_month INTEGER NOT NULL DEFAULT 1,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',

  -- Future probation fields.
  probation_required INTEGER NOT NULL DEFAULT 0,
  probation_status TEXT NOT NULL DEFAULT 'not_required',
  probation_activated_at TEXT,
  probation_activated_by TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO employees_v1 (
  employee_id,
  user_id,
  employee_code,
  employee_name,
  department,
  position,
  branch,
  start_date,
  employment_status,
  created_source,
  current_month,
  progress_percent,
  status,
  probation_required,
  probation_status,
  probation_activated_at,
  probation_activated_by,
  created_at,
  updated_at
)
SELECT
  employee_id,
  user_id,
  NULL AS employee_code,
  employee_name,
  department,
  position,
  NULL AS branch,
  NULL AS start_date,
  'active' AS employment_status,
  'manual' AS created_source,
  current_month,
  progress_percent,
  status,
  0 AS probation_required,
  'not_required' AS probation_status,
  NULL AS probation_activated_at,
  NULL AS probation_activated_by,
  created_at,
  updated_at
FROM employees;

DROP TABLE employees;
ALTER TABLE employees_v1 RENAME TO employees;

-- CSV import batch summary. One row per import run.
CREATE TABLE IF NOT EXISTS import_batches (
  batch_id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  new_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL
);

-- CSV row-level errors for audit and admin recovery.
CREATE TABLE IF NOT EXISTS import_errors (
  error_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  employee_code TEXT,
  error_message TEXT NOT NULL,
  raw_data TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id)
);

-- Audit log for LINE binding, unlink, rebind, and failed binding attempts.
CREATE TABLE IF NOT EXISTS line_bind_logs (
  log_id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  user_id TEXT,
  old_line_user_id TEXT,
  new_line_user_id TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Future probation case container. Probation round tasks will use tasks.task_type:
-- PROBATION_30, PROBATION_60, PROBATION_90.
-- Due date logic for future code:
-- 30 days = employee.start_date + 29 days
-- 60 days = employee.start_date + 59 days
-- 90 days = employee.start_date + 89 days
CREATE TABLE IF NOT EXISTS probation_cases (
  case_id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  evaluator_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  activated_at TEXT,
  activated_by TEXT,
  completed_at TEXT,
  result TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
  FOREIGN KEY (evaluator_user_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_start_date ON employees(start_date);
CREATE INDEX IF NOT EXISTS idx_employees_probation_status ON employees(probation_status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_status ON tasks(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_lifecycle ON tasks(owner_user_id, task_type, group_id, month_no, status);
CREATE INDEX IF NOT EXISTS idx_checkpoints_group_month ON checkpoints(group_id, month_no, session_date);

PRAGMA foreign_keys = on;
