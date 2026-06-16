CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  line_user_id TEXT UNIQUE,
  display_name TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  position TEXT,
  email TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
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

CREATE TABLE IF NOT EXISTS employees (
  employee_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  current_month INTEGER NOT NULL DEFAULT 1,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',
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
  updated_at TEXT NOT NULL
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
  updated_at TEXT NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_status ON tasks(owner_user_id, status);
