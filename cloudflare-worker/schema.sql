-- Nose Tea Onboarding database schema
-- Database Migration V1: Employee CSV import + LIFF binding + future probation.
-- This schema keeps the existing onboarding tables and adds future-ready fields.

CREATE TABLE IF NOT EXISTS users (
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

  -- Optional link to HR employee master data. Filled after LIFF employee_code binding.
  employee_id TEXT
);

-- Web login session for browser/admin usage.
CREATE TABLE IF NOT EXISTS web_sessions (
  session_id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS mentors (
  mentor_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mentor_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Editable LINE message template library.
CREATE TABLE IF NOT EXISTS message_templates (
  template_id TEXT PRIMARY KEY,
  template_key TEXT UNIQUE NOT NULL,
  audience TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  button_label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Onboarding cohort/group configuration.
CREATE TABLE IF NOT EXISTS onboarding_groups (
  group_id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 30,
  total_months INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Users assigned to onboarding groups. Mentor assignment is stored per mentee row.
CREATE TABLE IF NOT EXISTS group_members (
  group_member_id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  mentor_user_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS employees (
  employee_id TEXT PRIMARY KEY,

  -- Nullable because HR can import employee master data before the employee opens LIFF.
  user_id TEXT,

  -- Stable HR employee code. If an employee resigns and returns, HR issues a new code.
  employee_code TEXT UNIQUE,

  employee_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  branch TEXT,
  start_date TEXT,
  employment_status TEXT DEFAULT 'active',
  created_source TEXT DEFAULT 'manual',

  -- Existing onboarding fields remain intact.
  current_month INTEGER NOT NULL DEFAULT 1,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',

  -- Future probation flags. UI and activation flow will be built later.
  probation_required INTEGER NOT NULL DEFAULT 0,
  probation_status TEXT NOT NULL DEFAULT 'not_required',
  probation_activated_at TEXT,
  probation_activated_by TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  month_no INTEGER NOT NULL DEFAULT 1,
  checkpoint_name TEXT NOT NULL,
  session_date TEXT,
  start_time TEXT,
  end_time TEXT,
  room TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Open',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Optional onboarding cohort/group lifecycle link.
  group_id TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  checkpoint_id TEXT,
  owner_user_id TEXT NOT NULL,
  employee_id TEXT,
  mentor_user_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  priority TEXT NOT NULL DEFAULT 'Normal',
  due_date TEXT,
  submitted_at TEXT,
  submission_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Existing onboarding lifecycle fields.
  group_id TEXT,
  month_no INTEGER,

  -- Reminder tracking for onboarding and future probation tasks.
  last_reminder_at TEXT,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  reminder_policy TEXT DEFAULT 'repeat_until_submitted'
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id TEXT PRIMARY KEY,
  notification_type TEXT NOT NULL,
  target_user_id TEXT,
  message_title TEXT,
  message_body TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_by TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS message_logs (
  log_id TEXT PRIMARY KEY,
  target_user_id TEXT,
  line_user_id TEXT,
  message_body TEXT,
  status TEXT NOT NULL,
  sent_by TEXT,
  sent_at TEXT NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS counters (
  prefix TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

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

-- Audit log for LINE account binding, unlink, rebind, and failed binding attempts.
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

-- Future probation case container. Probation tasks will still use the tasks table.
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
CREATE INDEX IF NOT EXISTS idx_web_sessions_token_hash ON web_sessions(token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_start_date ON employees(start_date);
CREATE INDEX IF NOT EXISTS idx_employees_probation_status ON employees(probation_status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_status ON tasks(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_lifecycle ON tasks(owner_user_id, task_type, group_id, month_no, status);
CREATE INDEX IF NOT EXISTS idx_checkpoints_group_month ON checkpoints(group_id, month_no, session_date);
