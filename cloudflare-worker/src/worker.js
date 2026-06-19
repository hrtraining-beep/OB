import {
  CORS_HEADERS,
  json,
  nowIso,
  clean,
  addDays,
  sha256,
  normalizeRole,
  toPublicTask,
  progressFromTasks,
  publicUser,
  readJson
} from "./lib/core.js";
import { getEnrichedTaskForOwner } from "./lib/task-queries.js";
import { reminderFlexMessage, taskFlexMessage, previewFlexMessage } from "./lib/flex.js";

async function ensureWebSessions(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS web_sessions (
      session_id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_web_sessions_token_hash ON web_sessions(token_hash)").run();
}

async function ensureMessageTemplates(env) {
  await env.DB.prepare(`
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
    )
  `).run();

  const timestamp = nowIso();
  const defaults = [
    ["TPL001", "mentor_feedback_due", "Mentor", "Mentor Feedback Reminder", "Please complete your mentor feedback task in Nose Tea Onboarding.", "Give Feedback"],
    ["TPL002", "mentee_reflection_due", "Mentee", "Reflection Reminder", "Please submit your monthly reflection in Nose Tea Onboarding.", "Submit Reflection"],
    ["TPL003", "attendance_confirm", "Mentee", "Attendance Confirmation", "Please confirm your onboarding session attendance.", "Confirm Attendance"],
    ["TPL004", "session_announcement", "All", "Onboarding Session Announcement", "A new onboarding session is ready. Please open LIFF for details.", "Open Session"],
    ["TPL005", "overdue_task", "All", "Overdue Task Alert", "You have an overdue onboarding task. Please complete it as soon as possible.", "Open Task"]
  ];

  for (const row of defaults) {
    await env.DB.prepare(`
      INSERT INTO message_templates(template_id, template_key, audience, title, body, button_label, active, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(template_key) DO NOTHING
    `).bind(...row, timestamp, timestamp).run();
  }
}

async function ensureOnboardingGroups(env) {
  await env.DB.prepare(`
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
    )
  `).run();
  await env.DB.prepare(`
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
    )
  `).run();
}

async function ensureTaskLifecycle(env) {
  const alters = [
    "ALTER TABLE tasks ADD COLUMN group_id TEXT",
    "ALTER TABLE tasks ADD COLUMN month_no INTEGER"
  ];
  for (const sql of alters) {
    try {
      await env.DB.prepare(sql).run();
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column name")) throw error;
    }
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_lifecycle ON tasks(owner_user_id, task_type, group_id, month_no, status)").run();
}

async function ensureCheckpointLifecycle(env) {
  const alters = [
    "ALTER TABLE checkpoints ADD COLUMN group_id TEXT"
  ];
  for (const sql of alters) {
    try {
      await env.DB.prepare(sql).run();
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column name")) throw error;
    }
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_checkpoints_group_month ON checkpoints(group_id, month_no, session_date)").run();
}

function parseCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter(item => item.some(value => clean(value)));
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function employeeFromCsvRecord(headers, values) {
  const record = {};
  headers.forEach((header, index) => {
    record[header] = clean(values[index]);
  });
  return {
    employeeCode: clean(record.employee_code || record.code || record.emp_code || record.employeeid || record.employee_id),
    employeeName: clean(record.employee_name || record.name || record.full_name || record.fullname),
    department: clean(record.department || record.dept),
    position: clean(record.position || record.job_title || record.title),
    branch: clean(record.branch || record.location || record.store),
    startDate: clean(record.start_date || record.startdate || record.join_date || record.hire_date),
    employmentStatus: clean(record.employment_status || record.status || "active") || "active",
    probationRequired: ["1", "true", "yes", "y", "required"].includes(clean(record.probation_required || record.probation).toLowerCase()) ? 1 : 0
  };
}

function validateEmployeeInput(input, rowNumber = 0) {
  const employeeCode = clean(input.employeeCode);
  const employeeName = clean(input.employeeName);
  const department = clean(input.department);
  const position = clean(input.position);
  const branch = clean(input.branch);
  const startDate = clean(input.startDate);
  const employmentStatus = clean(input.employmentStatus || "active").toLowerCase();
  const probationRequired = input.probationRequired === true || input.probationRequired === "1" || input.probationRequired === 1 ? 1 : 0;
  const prefix = rowNumber ? `Row ${rowNumber}: ` : "";
  if (!employeeCode) throw new Error(`${prefix}employee_code is required.`);
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(employeeCode)) throw new Error(`${prefix}employee_code must use letters, numbers, dash, or underscore only.`);
  if (!employeeName) throw new Error(`${prefix}employee_name is required.`);
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error(`${prefix}start_date must be YYYY-MM-DD.`);
  if (!["active", "inactive", "resigned", "probation"].includes(employmentStatus)) throw new Error(`${prefix}employment_status is invalid.`);
  return { employeeCode, employeeName, department, position, branch, startDate, employmentStatus, probationRequired };
}

async function upsertEmployeeMaster(env, input, adminUser, source = "manual") {
  const data = validateEmployeeInput(input);
  const timestamp = nowIso();
  const requestedEmployeeId = clean(input.employeeId);
  const existing = requestedEmployeeId
    ? await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(requestedEmployeeId).first()
    : await env.DB.prepare("SELECT * FROM employees WHERE employee_code = ? LIMIT 1").bind(data.employeeCode).first();
  if (existing && existing.employee_code !== data.employeeCode) {
    const duplicate = await env.DB.prepare("SELECT employee_id FROM employees WHERE employee_code = ? LIMIT 1").bind(data.employeeCode).first();
    if (duplicate && duplicate.employee_id !== existing.employee_id) throw new Error("Employee code already exists.");
  }
  const employeeId = existing ? existing.employee_id : await nextId(env, "E");
  if (existing) {
    await env.DB.prepare(`
      UPDATE employees
      SET employee_code = ?, employee_name = ?, department = ?, position = ?, branch = ?, start_date = ?,
          employment_status = ?, probation_required = ?, probation_status = ?, updated_at = ?
      WHERE employee_id = ?
    `).bind(
      data.employeeCode,
      data.employeeName,
      data.department,
      data.position,
      data.branch,
      data.startDate || null,
      data.employmentStatus,
      data.probationRequired,
      data.probationRequired ? "draft" : "not_required",
      timestamp,
      employeeId
    ).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO employees(
        employee_id, user_id, employee_code, employee_name, department, position, branch, start_date,
        employment_status, created_source, current_month, progress_percent, status,
        probation_required, probation_status, created_at, updated_at
      )
      VALUES(?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'Active', ?, ?, ?, ?)
    `).bind(
      employeeId,
      data.employeeCode,
      data.employeeName,
      data.department,
      data.position,
      data.branch,
      data.startDate || null,
      data.employmentStatus,
      source,
      data.probationRequired,
      data.probationRequired ? "draft" : "not_required",
      timestamp,
      timestamp
    ).run();
  }
  return { employeeId, action: existing ? "updated" : "created", updatedBy: adminUser.user_id };
}

async function createOrUpdateLifecycleTask(env, payload) {
  await ensureTaskLifecycle(env);
  const timestamp = nowIso();
  const existing = await env.DB.prepare(`
    SELECT * FROM tasks
    WHERE owner_user_id = ?
      AND task_type = ?
      AND COALESCE(group_id, '') = COALESCE(?, '')
      AND COALESCE(month_no, 0) = COALESCE(?, 0)
      AND COALESCE(employee_id, '') = COALESCE(?, '')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(
    payload.ownerUserId,
    payload.taskType,
    payload.groupId || "",
    payload.monthNo || 0,
    payload.employeeId || ""
  ).first();

  if (existing && existing.status === "Completed") {
    return { action: "skipped_completed", taskId: existing.task_id };
  }

  if (existing) {
    await env.DB.prepare(`
      UPDATE tasks
      SET checkpoint_id = COALESCE(?, checkpoint_id),
          employee_id = COALESCE(?, employee_id),
          mentor_user_id = COALESCE(?, mentor_user_id),
          title = ?,
          description = ?,
          due_date = COALESCE(?, due_date),
          updated_at = ?
      WHERE task_id = ?
    `).bind(
      payload.checkpointId || null,
      payload.employeeId || null,
      payload.mentorUserId || null,
      payload.title,
      payload.description,
      payload.dueDate || null,
      timestamp,
      existing.task_id
    ).run();
    return { action: "updated_existing", taskId: existing.task_id };
  }

  const taskId = await nextId(env, "T");
  await env.DB.prepare(`
    INSERT INTO tasks(task_id, task_type, checkpoint_id, owner_user_id, employee_id, mentor_user_id, title, description, status, priority, due_date, created_at, updated_at, group_id, month_no)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Normal', ?, ?, ?, ?, ?)
  `).bind(
    taskId,
    payload.taskType,
    payload.checkpointId || null,
    payload.ownerUserId,
    payload.employeeId || null,
    payload.mentorUserId || null,
    payload.title,
    payload.description,
    payload.dueDate || null,
    timestamp,
    timestamp,
    payload.groupId || null,
    payload.monthNo || null
  ).run();
  return { action: "created", taskId };
}

async function resolveLineIdentity(env, input) {
  if (!input || typeof input !== "object") throw new Error("Missing LINE profile.");
  if (!input.idToken && input.lineUserId) {
    return {
      sub: clean(input.lineUserId),
      name: clean(input.lineDisplayName || input.displayName || input.name)
    };
  }

  const idToken = input.idToken;
  if (!idToken) throw new Error("Missing LINE identity token.");
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: env.LINE_LOGIN_CHANNEL_ID || "2010372532"
  });

  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "LINE identity verification failed.");
  }
  if (!data.sub) throw new Error("LINE identity did not include userId.");
  return data;
}

async function nextId(env, prefix) {
  const current = await env.DB.prepare("SELECT value FROM counters WHERE prefix = ?").bind(prefix).first();
  const value = (current ? current.value : 0) + 1;
  await env.DB.prepare(
    "INSERT INTO counters(prefix, value) VALUES(?, ?) ON CONFLICT(prefix) DO UPDATE SET value = excluded.value"
  ).bind(prefix, value).run();
  return `${prefix}${String(value).padStart(3, "0")}`;
}

async function getUserByLine(env, lineUserId) {
  return env.DB.prepare("SELECT * FROM users WHERE line_user_id = ? LIMIT 1").bind(lineUserId).first();
}

async function getUserByEmail(env, email) {
  return env.DB.prepare("SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1").bind(email).first();
}

async function getUserById(env, userId) {
  return env.DB.prepare("SELECT * FROM users WHERE user_id = ? LIMIT 1").bind(userId).first();
}

async function getUserFromWebSession(env, token) {
  const rawToken = clean(token);
  if (!rawToken) return null;
  await ensureWebSessions(env);
  const tokenHash = await sha256(rawToken);
  const session = await env.DB.prepare(`
    SELECT * FROM web_sessions
    WHERE token_hash = ? AND expires_at > ?
    LIMIT 1
  `).bind(tokenHash, nowIso()).first();
  if (!session) return null;
  await env.DB.prepare("UPDATE web_sessions SET last_used_at = ? WHERE session_id = ?").bind(nowIso(), session.session_id).run();
  return getUserById(env, session.user_id);
}

async function createWebSession(env, userId) {
  await ensureWebSessions(env);
  const token = crypto.randomUUID() + "." + crypto.randomUUID();
  const sessionId = await nextId(env, "S");
  const timestamp = nowIso();
  await env.DB.prepare(`
    INSERT INTO web_sessions(session_id, token_hash, user_id, expires_at, created_at, last_used_at)
    VALUES(?, ?, ?, ?, ?, ?)
  `).bind(sessionId, await sha256(token), userId, addDays(new Date(), 7).toISOString(), timestamp, timestamp).run();
  return token;
}

async function ensureRoleProfile(env, user) {
  const timestamp = nowIso();
  if (user.role === "Mentor") {
    await env.DB.prepare(`
      INSERT INTO mentors(mentor_id, user_id, mentor_name, department, position, active, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(mentor_id) DO UPDATE SET
        mentor_name = excluded.mentor_name,
        department = excluded.department,
        position = excluded.position,
        active = 1,
        updated_at = excluded.updated_at
    `).bind(user.user_id.replace(/^U/, "M"), user.user_id, user.name, user.department, user.position || "", timestamp, timestamp).run();
  }

  if (user.role === "Mentee") {
    if (user.employee_id) {
      await env.DB.prepare(`
        UPDATE employees
        SET user_id = ?, employee_name = COALESCE(NULLIF(employee_name, ''), ?), department = COALESCE(NULLIF(department, ''), ?), position = COALESCE(NULLIF(position, ''), ?), updated_at = ?
        WHERE employee_id = ?
      `).bind(user.user_id, user.name, user.department, user.position || "", timestamp, user.employee_id).run();
      return;
    }
    await env.DB.prepare(`
      INSERT INTO employees(employee_id, user_id, employee_name, department, position, current_month, progress_percent, status, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, 1, 0, 'Active', ?, ?)
      ON CONFLICT(employee_id) DO UPDATE SET
        employee_name = excluded.employee_name,
        department = excluded.department,
        position = excluded.position,
        updated_at = excluded.updated_at
    `).bind(user.user_id.replace(/^U/, "E"), user.user_id, user.name, user.department, user.position || "", timestamp, timestamp).run();
  }
}

async function registerUser(request, env) {
  const input = await readJson(request);
  const verified = await resolveLineIdentity(env, input);
  const lineUserId = verified.sub;
  const email = clean(input.email).toLowerCase();
  const role = normalizeRole(input.role);
  const name = clean(input.name || verified.name);
  const department = clean(input.department);
  const position = clean(input.position);
  const employeeCode = clean(input.employeeCode);

  if (!/@nosetea\.com$/i.test(email)) throw new Error("Please use your @nosetea.com email.");
  if (!name) throw new Error("Please enter your name.");
  if (!department) throw new Error("Please enter your department.");

  const adminEmails = clean(env.ADMIN_EMAILS).split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  const finalRole = adminEmails.includes(email) ? "HR" : role;
  const existing = await getUserByLine(env, lineUserId) || await getUserByEmail(env, email);
  const userId = existing ? existing.user_id : await nextId(env, "U");
  const timestamp = nowIso();
  const matchedEmployee = employeeCode
    ? await env.DB.prepare("SELECT * FROM employees WHERE employee_code = ? LIMIT 1").bind(employeeCode).first()
    : null;
  if (employeeCode && !matchedEmployee) throw new Error("Employee code not found. Please check with HR.");
  if (matchedEmployee && matchedEmployee.user_id && matchedEmployee.user_id !== userId) {
    throw new Error("This employee code is already linked to another LINE account. Please contact HR.");
  }

  await env.DB.prepare(`
    INSERT INTO users(user_id, employee_id, line_user_id, display_name, name, role, department, position, email, active, created_at, updated_at, last_login_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      employee_id = excluded.employee_id,
      line_user_id = excluded.line_user_id,
      display_name = excluded.display_name,
      name = excluded.name,
      role = excluded.role,
      department = excluded.department,
      position = excluded.position,
      email = excluded.email,
      active = 1,
      updated_at = excluded.updated_at,
      last_login_at = excluded.last_login_at
  `).bind(
    userId,
    matchedEmployee ? matchedEmployee.employee_id : (existing ? existing.employee_id || null : null),
    lineUserId,
    verified.name || input.lineDisplayName || name,
    name,
    finalRole,
    department,
    position,
    email,
    existing ? existing.created_at : timestamp,
    timestamp,
    timestamp
  ).run();

  const user = await getUserById(env, userId);
  if (matchedEmployee) {
    await env.DB.prepare(`
      UPDATE employees
      SET user_id = ?, updated_at = ?
      WHERE employee_id = ?
    `).bind(userId, timestamp, matchedEmployee.employee_id).run();
    await env.DB.prepare(`
      INSERT INTO line_bind_logs(log_id, employee_id, user_id, old_line_user_id, new_line_user_id, action, reason, created_by, created_at)
      VALUES(?, ?, ?, ?, ?, 'bind', 'self_register', ?, ?)
    `).bind(
      crypto.randomUUID(),
      matchedEmployee.employee_id,
      userId,
      existing ? existing.line_user_id || null : null,
      lineUserId,
      userId,
      timestamp
    ).run();
  }
  await ensureRoleProfile(env, user);
  return json({ ok: true, user: publicUser(user) });
}

async function webLoginExchange(request, env) {
  const input = await readJson(request);
  const code = clean(input.code);
  const redirectUri = clean(input.redirectUri);
  if (!code || !redirectUri) throw new Error("Missing LINE login code.");
  if (!env.LINE_LOGIN_CHANNEL_SECRET) throw new Error("Missing LINE_LOGIN_CHANNEL_SECRET secret.");

  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.LINE_LOGIN_CHANNEL_ID || "2010372532",
      client_secret: env.LINE_LOGIN_CHANNEL_SECRET
    })
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    throw new Error(tokenData.error_description || tokenData.error || "LINE web login failed.");
  }

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || !profile.userId) throw new Error("Unable to read LINE profile.");

  const user = await getUserByLine(env, profile.userId);
  if (!user || user.role !== "HR") throw new Error("This LINE account is not registered as HR admin.");
  const token = await createWebSession(env, user.user_id);
  return json({ ok: true, token, user: publicUser(user), expiresInDays: 7 });
}

async function getPortal(request, env) {
  const input = await readJson(request);
  const verified = await resolveLineIdentity(env, input);
  const user = await getUserByLine(env, verified.sub);
  if (!user) return json({ ok: true, registered: false });
  await ensureOnboardingGroups(env);
  await ensureTaskLifecycle(env);

  const tasks = await env.DB.prepare(`
    SELECT
      t.*,
      c.session_date,
      c.start_time,
      c.end_time,
      c.room,
      eu.name AS employee_name,
      mu.name AS mentor_name
    FROM tasks t
    LEFT JOIN checkpoints c ON c.checkpoint_id = t.checkpoint_id
    LEFT JOIN employees e ON e.employee_id = t.employee_id
    LEFT JOIN users eu ON eu.user_id = e.user_id
    LEFT JOIN users mu ON mu.user_id = t.mentor_user_id
    WHERE t.owner_user_id = ?
    ORDER BY
      CASE t.status WHEN 'Pending' THEN 0 WHEN 'Open' THEN 1 WHEN 'Completed' THEN 2 ELSE 3 END,
      t.due_date ASC
    LIMIT 100
  `).bind(user.user_id).all();
  const publicTasks = tasks.results.map(toPublicTask);
  let mentees = [];
  let mentor = null;
  let onboardingGroup = null;
  if (user.role === "Mentor") {
    const mentorMentees = await env.DB.prepare(`
      SELECT
        e.employee_id,
        u.user_id,
        u.name,
        u.department,
        u.position,
        MAX(COALESCE(t.month_no, 1)) AS current_month,
        SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) AS completed_tasks,
        COUNT(t.task_id) AS total_tasks,
        SUM(CASE WHEN t.owner_user_id = ? AND t.status IN ('Pending', 'Open') THEN 1 ELSE 0 END) AS pending_feedback
      FROM tasks t
      JOIN employees e ON e.employee_id = t.employee_id
      JOIN users u ON u.user_id = e.user_id
      WHERE t.mentor_user_id = ?
      GROUP BY e.employee_id, u.user_id, u.name, u.department, u.position
      ORDER BY u.name ASC
    `).bind(user.user_id, user.user_id).all();
    mentees = mentorMentees.results.map(row => ({
      employeeId: row.employee_id,
      userId: row.user_id,
      name: row.name,
      department: row.department,
      position: row.position,
      currentMonth: row.current_month || 1,
      completedTasks: row.completed_tasks || 0,
      totalTasks: row.total_tasks || 0,
      pendingFeedback: row.pending_feedback || 0,
      progressPercent: row.total_tasks ? Math.round((row.completed_tasks / row.total_tasks) * 100) : 0
    }));
  }
  if (user.role === "Mentee") {
    const assignment = await env.DB.prepare(`
      SELECT
        gm.group_id,
        gm.mentor_user_id,
        og.group_name,
        og.start_date,
        og.interval_days,
        og.total_months,
        mu.name AS mentor_name,
        mu.department AS mentor_department,
        mu.position AS mentor_position,
        mu.email AS mentor_email
      FROM group_members gm
      LEFT JOIN onboarding_groups og ON og.group_id = gm.group_id
      LEFT JOIN users mu ON mu.user_id = gm.mentor_user_id
      WHERE gm.user_id = ? AND gm.active = 1
      ORDER BY gm.updated_at DESC
      LIMIT 1
    `).bind(user.user_id).first();
    if (assignment) {
      onboardingGroup = {
        groupId: assignment.group_id,
        groupName: assignment.group_name,
        startDate: assignment.start_date,
        intervalDays: assignment.interval_days,
        totalMonths: assignment.total_months
      };
      if (assignment.mentor_user_id) {
        mentor = {
          userId: assignment.mentor_user_id,
          name: assignment.mentor_name,
          department: assignment.mentor_department,
          position: assignment.mentor_position,
          email: assignment.mentor_email
        };
      }
    }
  }

  return json({
    ok: true,
    registered: true,
    user: publicUser(user),
    tasks: publicTasks,
    progress: progressFromTasks(publicTasks),
    mentees,
    mentor,
    onboardingGroup
  });
}

async function getTask(request, env) {
  const input = await readJson(request);
  const verified = await resolveLineIdentity(env, input);
  const user = await getUserByLine(env, verified.sub);
  if (!user) throw new Error("Please register before opening tasks.");

  const task = await env.DB.prepare(`
    SELECT
      t.*,
      c.session_date,
      c.start_time,
      c.end_time,
      c.room,
      eu.name AS employee_name,
      mu.name AS mentor_name
    FROM tasks t
    LEFT JOIN checkpoints c ON c.checkpoint_id = t.checkpoint_id
    LEFT JOIN employees e ON e.employee_id = t.employee_id
    LEFT JOIN users eu ON eu.user_id = e.user_id
    LEFT JOIN users mu ON mu.user_id = t.mentor_user_id
    WHERE t.task_id = ?
    LIMIT 1
  `).bind(clean(input.taskId)).first();
  if (!task) throw new Error("Task not found.");
  if (task.owner_user_id !== user.user_id && user.role !== "HR") throw new Error("This task does not belong to you.");
  return json({ ok: true, user: publicUser(user), task: toPublicTask(task) });
}

async function requireAdmin(request, env) {
  const input = await readJson(request);
  if (input.webSessionToken) {
    const webUser = await getUserFromWebSession(env, input.webSessionToken);
    if (!webUser || webUser.role !== "HR") throw new Error("Admin web session required.");
    return { input, user: webUser };
  }
  const verified = await resolveLineIdentity(env, input);
  const user = await getUserByLine(env, verified.sub);
  if (!user || user.role !== "HR") throw new Error("Admin access required.");
  return { input, user };
}

async function adminData(request, env) {
  const { user } = await requireAdmin(request, env);
  await ensureMessageTemplates(env);
  await ensureOnboardingGroups(env);
  await ensureTaskLifecycle(env);
  await ensureCheckpointLifecycle(env);
  const [users, employees, importBatches, bindLogs, tasks, checkpoints, notifications, templates, groups, groupMembers] = await Promise.all([
    env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 200").all(),
    env.DB.prepare(`
      SELECT e.*, u.name AS linked_name, u.email AS linked_email, u.line_user_id AS linked_line_user_id, u.role AS linked_role
      FROM employees e
      LEFT JOIN users u ON u.user_id = e.user_id
      ORDER BY e.updated_at DESC
      LIMIT 500
    `).all(),
    env.DB.prepare("SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 50").all(),
    env.DB.prepare("SELECT * FROM line_bind_logs ORDER BY created_at DESC LIMIT 100").all(),
    env.DB.prepare("SELECT * FROM tasks ORDER BY created_at DESC LIMIT 300").all(),
    env.DB.prepare("SELECT * FROM checkpoints ORDER BY session_date ASC LIMIT 200").all(),
    env.DB.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100").all(),
    env.DB.prepare("SELECT * FROM message_templates ORDER BY audience ASC, template_key ASC").all(),
    env.DB.prepare("SELECT * FROM onboarding_groups ORDER BY start_date DESC LIMIT 100").all(),
    env.DB.prepare(`
      SELECT gm.*, u.name, u.department, u.position, u.email
      FROM group_members gm
      JOIN users u ON u.user_id = gm.user_id
      WHERE gm.active = 1
      ORDER BY gm.created_at DESC
      LIMIT 500
    `).all()
  ]);

  return json({
    ok: true,
    currentUser: publicUser(user),
    users: users.results.map(publicUser),
    employees: employees.results.map(row => ({
      employeeId: row.employee_id,
      userId: row.user_id,
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      department: row.department,
      position: row.position,
      branch: row.branch,
      startDate: row.start_date,
      employmentStatus: row.employment_status,
      createdSource: row.created_source,
      currentMonth: row.current_month,
      progressPercent: row.progress_percent,
      status: row.status,
      probationRequired: Boolean(row.probation_required),
      probationStatus: row.probation_status,
      linkedName: row.linked_name,
      linkedEmail: row.linked_email,
      linkedLineUserId: row.linked_line_user_id,
      linkedRole: row.linked_role,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    importBatches: importBatches.results.map(row => ({
      batchId: row.batch_id,
      importType: row.import_type,
      fileName: row.file_name,
      totalRows: row.total_rows,
      newRows: row.new_rows,
      updatedRows: row.updated_rows,
      skippedRows: row.skipped_rows,
      errorRows: row.error_rows,
      createdBy: row.created_by,
      createdAt: row.created_at
    })),
    bindLogs: bindLogs.results.map(row => ({
      logId: row.log_id,
      employeeId: row.employee_id,
      userId: row.user_id,
      action: row.action,
      reason: row.reason,
      createdBy: row.created_by,
      createdAt: row.created_at
    })),
    tasks: tasks.results.map(row => ({
      taskId: row.task_id,
      title: row.title,
      taskType: row.task_type,
      ownerUserId: row.owner_user_id,
      status: row.status,
      dueDate: row.due_date,
      submittedAt: row.submitted_at
    })),
    sessions: checkpoints.results.map(row => ({
      checkpointId: row.checkpoint_id,
      groupId: row.group_id || null,
      monthNo: row.month_no,
      checkpointName: row.checkpoint_name,
      sessionDate: row.session_date,
      startTime: row.start_time,
      endTime: row.end_time,
      room: row.room,
      description: row.description,
      status: row.status
    })),
    notifications: notifications.results,
    groups: groups.results.map(row => ({
      groupId: row.group_id,
      groupName: row.group_name,
      startDate: row.start_date,
      intervalDays: row.interval_days,
      totalMonths: row.total_months,
      status: row.status
    })),
    groupMembers: groupMembers.results.map(row => ({
      groupMemberId: row.group_member_id,
      groupId: row.group_id,
      userId: row.user_id,
      role: row.role,
      mentorUserId: row.mentor_user_id,
      name: row.name,
      department: row.department,
      position: row.position,
      email: row.email,
      active: Boolean(row.active)
    })),
    templates: templates.results.map(row => ({
      templateId: row.template_id,
      templateKey: row.template_key,
      audience: row.audience,
      title: row.title,
      body: row.body,
      buttonLabel: row.button_label,
      active: Boolean(row.active)
    })),
    summary: {
      totalUsers: users.results.length,
      totalEmployees: employees.results.length,
      linkedEmployees: employees.results.filter(row => row.user_id).length,
      unlinkedEmployees: employees.results.filter(row => !row.user_id).length,
      mentors: users.results.filter(row => row.role === "Mentor" && row.active).length,
      mentees: users.results.filter(row => row.role === "Mentee" && row.active).length,
      activeGroups: groups.results.filter(row => row.status === "Active").length,
      openSessions: checkpoints.results.filter(row => row.status !== "Closed").length,
      pendingTasks: tasks.results.filter(row => row.status !== "Completed").length
    },
    recentQueue: tasks.results
      .filter(row => row.status !== "Completed")
      .slice(0, 12)
      .map(row => ({
        taskId: row.task_id,
        title: row.title,
        taskType: row.task_type,
        ownerUserId: row.owner_user_id,
        employeeId: row.employee_id,
        mentorUserId: row.mentor_user_id,
        status: row.status,
        dueDate: row.due_date,
        monthNo: row.month_no || null
      }))
  });
}

async function upsertMessageTemplate(request, env) {
  const { input } = await requireAdmin(request, env);
  await ensureMessageTemplates(env);
  const templateId = clean(input.templateId) || await nextId(env, "TPL");
  const templateKey = clean(input.templateKey);
  const audience = clean(input.audience || "All");
  const title = clean(input.title);
  const body = clean(input.body);
  const buttonLabel = clean(input.buttonLabel || "Open LIFF");
  if (!templateKey || !title || !body) throw new Error("Template key, title, and body are required.");
  const timestamp = nowIso();
  await env.DB.prepare(`
    INSERT INTO message_templates(template_id, template_key, audience, title, body, button_label, active, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(template_key) DO UPDATE SET
      audience = excluded.audience,
      title = excluded.title,
      body = excluded.body,
      button_label = excluded.button_label,
      active = excluded.active,
      updated_at = excluded.updated_at
  `).bind(
    templateId,
    templateKey,
    audience,
    title,
    body,
    buttonLabel,
    input.active === false || input.active === "0" ? 0 : 1,
    timestamp,
    timestamp
  ).run();
  return json({ ok: true, templateId });
}

async function createOnboardingGroup(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureOnboardingGroups(env);
  const groupId = await nextId(env, "G");
  const timestamp = nowIso();
  const groupName = clean(input.groupName);
  const startDate = clean(input.startDate);
  if (!groupName || !startDate) throw new Error("Group name and start date are required.");
  await env.DB.prepare(`
    INSERT INTO onboarding_groups(group_id, group_name, start_date, interval_days, total_months, status, created_by, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, 'Active', ?, ?, ?)
  `).bind(
    groupId,
    groupName,
    startDate,
    Number(input.intervalDays || 30),
    Number(input.totalMonths || 4),
    user.user_id,
    timestamp,
    timestamp
  ).run();
  return json({ ok: true, groupId });
}

async function updateGroupMembers(request, env) {
  const { input } = await requireAdmin(request, env);
  await ensureOnboardingGroups(env);
  const groupId = clean(input.groupId);
  const userIds = Array.isArray(input.userIds) ? input.userIds.map(clean).filter(Boolean) : [];
  const mentorUserId = clean(input.mentorUserId);
  if (!groupId) throw new Error("Group ID required.");
  const timestamp = nowIso();
  let added = 0;

  await env.DB.prepare(`
    UPDATE group_members
    SET active = 0, updated_at = ?
    WHERE group_id = ?
      AND role = 'Mentee'
      AND user_id NOT IN (${userIds.length ? userIds.map(() => "?").join(", ") : "''"})
  `).bind(timestamp, groupId, ...userIds).run();

  for (const userId of userIds) {
    const member = await getUserById(env, userId);
    if (!member) continue;
    const groupMemberId = await nextId(env, "GM");
    await env.DB.prepare(`
      INSERT INTO group_members(group_member_id, group_id, user_id, role, mentor_user_id, active, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(group_id, user_id) DO UPDATE SET
        role = excluded.role,
        mentor_user_id = excluded.mentor_user_id,
        active = 1,
        updated_at = excluded.updated_at
    `).bind(
      groupMemberId,
      groupId,
      userId,
      member.role,
      member.role === "Mentee" ? mentorUserId || null : null,
      timestamp,
      timestamp
    ).run();
    added += 1;
  }
  return json({ ok: true, added });
}

async function deleteMessageTemplate(request, env) {
  const { input } = await requireAdmin(request, env);
  const templateId = clean(input.templateId);
  if (!templateId) throw new Error("Template ID required.");
  await ensureMessageTemplates(env);
  await env.DB.prepare("UPDATE message_templates SET active = 0, updated_at = ? WHERE template_id = ?").bind(nowIso(), templateId).run();
  return json({ ok: true });
}

async function createCheckpoint(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureTaskLifecycle(env);
  await ensureCheckpointLifecycle(env);
  const checkpointId = await nextId(env, "CP");
  const timestamp = nowIso();
  const monthNo = Number(input.monthNo || 1);

  await env.DB.prepare(`
    INSERT INTO checkpoints(checkpoint_id, group_id, month_no, checkpoint_name, session_date, start_time, end_time, room, description, status, created_by, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?)
  `).bind(
    checkpointId,
    clean(input.groupId) || null,
    monthNo,
    clean(input.checkpointName),
    clean(input.sessionDate),
    clean(input.startTime),
    clean(input.endTime),
    clean(input.room),
    clean(input.description),
    user.user_id,
    timestamp,
    timestamp
  ).run();

  if (input.autoCreateTasks !== false && input.autoCreateTasks !== "0") {
    const dueDate = clean(input.sessionDate);
    const groupId = clean(input.groupId);
    const mentees = groupId
      ? await env.DB.prepare(`
          SELECT u.*, e.employee_id, gm.mentor_user_id
          FROM group_members gm
          JOIN users u ON u.user_id = gm.user_id
          LEFT JOIN employees e ON e.user_id = u.user_id
          WHERE gm.group_id = ? AND gm.active = 1 AND u.role = 'Mentee' AND u.active = 1
        `).bind(groupId).all()
      : await env.DB.prepare(`
          SELECT u.*, e.employee_id, NULL AS mentor_user_id
          FROM users u
          LEFT JOIN employees e ON e.user_id = u.user_id
          WHERE u.role = 'Mentee' AND u.active = 1
        `).all();
    const mentors = groupId
      ? await env.DB.prepare(`
          SELECT DISTINCT u.*
          FROM group_members gm
          JOIN users u ON u.user_id = COALESCE(gm.mentor_user_id, gm.user_id)
          WHERE gm.group_id = ? AND u.role = 'Mentor' AND u.active = 1
        `).bind(groupId).all()
      : await env.DB.prepare("SELECT * FROM users WHERE role = 'Mentor' AND active = 1").all();

    for (const mentee of mentees.results) {
      for (const taskType of ["Attendance", "Reflection"]) {
        await createOrUpdateLifecycleTask(env, {
          taskType,
          checkpointId,
          ownerUserId: mentee.user_id,
          employeeId: mentee.employee_id || null,
          mentorUserId: null,
          title: `${clean(input.checkpointName)} - ${taskType}`,
          description: taskType === "Attendance" ? "Confirm onboarding session attendance." : "Submit onboarding reflection.",
          dueDate,
          groupId,
          monthNo
        });
      }
    }

    for (const mentor of mentors.results) {
      const assignedMentees = mentees.results.filter(row => !row.mentor_user_id || row.mentor_user_id === mentor.user_id);
      for (const mentee of assignedMentees) {
        await createOrUpdateLifecycleTask(env, {
          taskType: "Feedback",
          checkpointId,
          ownerUserId: mentor.user_id,
          employeeId: mentee.employee_id || null,
          mentorUserId: mentor.user_id,
          title: `${clean(input.checkpointName)} - Mentor Feedback (${mentee.name})`,
          description: "Evaluate assigned mentee onboarding progress.",
          dueDate,
          groupId,
          monthNo
        });
      }
    }
  }

  return json({ ok: true, checkpointId });
}

async function updateCheckpoint(request, env) {
  const { input } = await requireAdmin(request, env);
  await ensureCheckpointLifecycle(env);
  const checkpointId = clean(input.checkpointId);
  if (!checkpointId) throw new Error("Checkpoint ID required.");

  const existing = await env.DB.prepare("SELECT * FROM checkpoints WHERE checkpoint_id = ? LIMIT 1").bind(checkpointId).first();
  if (!existing) throw new Error("Session not found.");

  await env.DB.prepare(`
    UPDATE checkpoints
    SET group_id = ?, month_no = ?, checkpoint_name = ?, session_date = ?, start_time = ?, end_time = ?, room = ?, description = ?, updated_at = ?
    WHERE checkpoint_id = ?
  `).bind(
    clean(input.groupId) || existing.group_id || null,
    Number(input.monthNo || existing.month_no || 1),
    clean(input.checkpointName) || existing.checkpoint_name,
    clean(input.sessionDate) || existing.session_date,
    clean(input.startTime) || existing.start_time,
    clean(input.endTime) || existing.end_time,
    clean(input.room) || existing.room,
    clean(input.description) || existing.description,
    nowIso(),
    checkpointId
  ).run();

  return json({ ok: true, checkpointId });
}

async function syncGroupLifecycle(request, env) {
  const { user } = await requireAdmin(request, env);
  await ensureOnboardingGroups(env);
  await ensureTaskLifecycle(env);
  await ensureCheckpointLifecycle(env);

  const groups = await env.DB.prepare("SELECT * FROM onboarding_groups WHERE status = 'Active' ORDER BY start_date ASC").all();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let createdCheckpoints = 0;
  let updatedTasks = 0;
  let createdTasks = 0;
  let skippedCompleted = 0;

  for (const group of groups.results) {
    const startDate = clean(group.start_date);
    if (!startDate) continue;
    const base = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(base.getTime())) continue;

    for (let monthNo = 1; monthNo <= Number(group.total_months || 0); monthNo += 1) {
      const dueDateObj = addDays(base, (monthNo - 1) * Number(group.interval_days || 30));
      dueDateObj.setHours(0, 0, 0, 0);
      const dueDate = dueDateObj.toISOString().slice(0, 10);

      let checkpoint = await env.DB.prepare(`
        SELECT * FROM checkpoints
        WHERE group_id = ? AND month_no = ?
        ORDER BY session_date ASC, created_at ASC
        LIMIT 1
      `).bind(group.group_id, monthNo).first();

      if (!checkpoint) {
        const checkpointId = await nextId(env, "CP");
        const title = `Month ${monthNo} - ${group.group_name}`;
        await env.DB.prepare(`
          INSERT INTO checkpoints(checkpoint_id, group_id, month_no, checkpoint_name, session_date, start_time, end_time, room, description, status, created_by, created_at, updated_at)
          VALUES(?, ?, ?, ?, ?, '', '', '', ?, ?, ?, ?, ?)
        `).bind(
          checkpointId,
          group.group_id,
          monthNo,
          title,
          dueDate,
          `Auto-generated from onboarding group ${group.group_name}`,
          dueDateObj <= today ? "Open" : "Planned",
          user.user_id,
          nowIso(),
          nowIso()
        ).run();
        checkpoint = await env.DB.prepare("SELECT * FROM checkpoints WHERE checkpoint_id = ? LIMIT 1").bind(checkpointId).first();
        createdCheckpoints += 1;
      }

      if (dueDateObj > today) continue;

      const mentees = await env.DB.prepare(`
        SELECT u.*, e.employee_id, gm.mentor_user_id
        FROM group_members gm
        JOIN users u ON u.user_id = gm.user_id
        LEFT JOIN employees e ON e.user_id = u.user_id
        WHERE gm.group_id = ? AND gm.active = 1 AND u.role = 'Mentee' AND u.active = 1
      `).bind(group.group_id).all();

      const mentors = await env.DB.prepare(`
        SELECT DISTINCT u.*
        FROM group_members gm
        JOIN users u ON u.user_id = COALESCE(gm.mentor_user_id, gm.user_id)
        WHERE gm.group_id = ? AND u.role = 'Mentor' AND u.active = 1
      `).bind(group.group_id).all();

      for (const mentee of mentees.results) {
        for (const taskType of ["Attendance", "Reflection"]) {
          const result = await createOrUpdateLifecycleTask(env, {
            taskType,
            checkpointId: checkpoint.checkpoint_id,
            ownerUserId: mentee.user_id,
            employeeId: mentee.employee_id || null,
            mentorUserId: mentee.mentor_user_id || null,
            title: `${checkpoint.checkpoint_name} - ${taskType}`,
            description: taskType === "Attendance" ? "Confirm onboarding session attendance." : "Submit onboarding reflection.",
            dueDate,
            groupId: group.group_id,
            monthNo
          });
          if (result.action === "skipped_completed") skippedCompleted += 1;
          else if (result.action === "updated_existing") updatedTasks += 1;
          else createdTasks += 1;
        }
      }

      for (const mentor of mentors.results) {
        const assignedMentees = mentees.results.filter(row => !row.mentor_user_id || row.mentor_user_id === mentor.user_id);
        for (const mentee of assignedMentees) {
          const result = await createOrUpdateLifecycleTask(env, {
            taskType: "Feedback",
            checkpointId: checkpoint.checkpoint_id,
            ownerUserId: mentor.user_id,
            employeeId: mentee.employee_id || null,
            mentorUserId: mentor.user_id,
            title: `${checkpoint.checkpoint_name} - Mentor Feedback (${mentee.name})`,
            description: "Evaluate assigned mentee onboarding progress.",
            dueDate,
            groupId: group.group_id,
            monthNo
          });
          if (result.action === "skipped_completed") skippedCompleted += 1;
          else if (result.action === "updated_existing") updatedTasks += 1;
          else createdTasks += 1;
        }
      }
    }
  }

  return json({
    ok: true,
    createdCheckpoints,
    createdTasks,
    updatedTasks,
    skippedCompleted
  });
}

async function adminUpdateUser(request, env) {
  const { input } = await requireAdmin(request, env);
  const userId = clean(input.userId);
  const existing = await getUserById(env, userId);
  if (!existing) throw new Error("User not found.");

  const name = clean(input.name);
  const department = clean(input.department);
  const email = clean(input.email).toLowerCase();
  const role = normalizeRole(input.role);
  if (!name) throw new Error("Name is required.");
  if (!department) throw new Error("Department is required.");
  if (!/@nosetea\.com$/i.test(email)) throw new Error("Please use @nosetea.com email.");

  const timestamp = nowIso();
  await env.DB.prepare(`
    UPDATE users
    SET name = ?, role = ?, department = ?, position = ?, email = ?, active = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(
    name,
    role,
    department,
    clean(input.position),
    email,
    input.active === false || input.active === "0" ? 0 : 1,
    timestamp,
    userId
  ).run();

  const updated = await getUserById(env, userId);
  await ensureRoleProfile(env, updated);

  if (role !== "Mentor") {
    await env.DB.prepare("UPDATE mentors SET active = 0, updated_at = ? WHERE user_id = ?").bind(timestamp, userId).run();
  }
  if (role !== "Mentee") {
    await env.DB.prepare("UPDATE employees SET status = 'Inactive', updated_at = ? WHERE user_id = ?").bind(timestamp, userId).run();
  }

  return json({ ok: true, user: publicUser(updated) });
}

async function adminUpsertEmployee(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const result = await upsertEmployeeMaster(env, input, user, "manual");
  return json({ ok: true, ...result });
}

async function adminUnlinkEmployee(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const employeeId = clean(input.employeeId);
  if (!employeeId) throw new Error("Employee ID required.");
  const employee = await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(employeeId).first();
  if (!employee) throw new Error("Employee not found.");
  const linkedUser = employee.user_id ? await getUserById(env, employee.user_id) : null;
  const timestamp = nowIso();
  await env.DB.prepare("UPDATE employees SET user_id = NULL, updated_at = ? WHERE employee_id = ?").bind(timestamp, employeeId).run();
  if (linkedUser && linkedUser.employee_id === employeeId) {
    await env.DB.prepare("UPDATE users SET employee_id = NULL, updated_at = ? WHERE user_id = ?").bind(timestamp, linkedUser.user_id).run();
  }
  await env.DB.prepare(`
    INSERT INTO line_bind_logs(log_id, employee_id, user_id, old_line_user_id, new_line_user_id, action, reason, created_by, created_at)
    VALUES(?, ?, ?, ?, NULL, 'unlink', ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    employeeId,
    linkedUser ? linkedUser.user_id : null,
    linkedUser ? linkedUser.line_user_id || null : null,
    clean(input.reason || "admin_unlink"),
    user.user_id,
    timestamp
  ).run();
  return json({ ok: true });
}

async function adminImportEmployees(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const csvText = String(input.csvText || "");
  const fileName = clean(input.fileName || "employee-import.csv").slice(0, 120);
  if (csvText.length > 300000) throw new Error("CSV is too large for one import. Please split the file.");
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error("CSV must include a header row and at least one employee row.");
  const headers = rows[0].map(normalizeHeader);
  const required = ["employee_code", "employee_name"];
  for (const header of required) {
    if (!headers.includes(header) && !(header === "employee_name" && headers.includes("name"))) {
      throw new Error(`CSV missing required header: ${header}`);
    }
  }

  const batchId = await nextId(env, "IMP");
  const timestamp = nowIso();
  let newRows = 0;
  let updatedRows = 0;
  let skippedRows = 0;
  let errorRows = 0;
  const seen = new Set();

  await env.DB.prepare(`
    INSERT INTO import_batches(batch_id, import_type, file_name, total_rows, created_by, created_at)
    VALUES(?, 'employee_master', ?, ?, ?, ?)
  `).bind(batchId, fileName, rows.length - 1, user.user_id, timestamp).run();

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const raw = rows[index];
    try {
      const employee = employeeFromCsvRecord(headers, raw);
      const validated = validateEmployeeInput(employee, rowNumber);
      const codeKey = validated.employeeCode.toLowerCase();
      if (seen.has(codeKey)) {
        skippedRows += 1;
        throw new Error(`Row ${rowNumber}: duplicate employee_code in this file.`);
      }
      seen.add(codeKey);
      const result = await upsertEmployeeMaster(env, validated, user, "csv");
      if (result.action === "created") newRows += 1;
      else updatedRows += 1;
    } catch (error) {
      errorRows += 1;
      await env.DB.prepare(`
        INSERT INTO import_errors(error_id, batch_id, row_number, employee_code, error_message, raw_data, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        batchId,
        rowNumber,
        clean(raw[headers.indexOf("employee_code")] || ""),
        error.message || String(error),
        JSON.stringify(raw),
        nowIso()
      ).run();
    }
  }

  await env.DB.prepare(`
    UPDATE import_batches
    SET new_rows = ?, updated_rows = ?, skipped_rows = ?, error_rows = ?
    WHERE batch_id = ?
  `).bind(newRows, updatedRows, skippedRows, errorRows, batchId).run();

  return json({ ok: true, batchId, totalRows: rows.length - 1, newRows, updatedRows, skippedRows, errorRows });
}

async function forceTasks(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureTaskLifecycle(env);
  const taskType = clean(input.taskType || "Reflection");
  const title = clean(input.title || `${taskType} Task`);
  const description = clean(input.description || `Please complete ${title}`);
  const dueDate = clean(input.dueDate);
  const monthNo = Number(input.monthNo || 1);
  const groupId = clean(input.groupId);
  const ownerRole = taskType === "Feedback" ? "Mentor" : "Mentee";
  const owners = groupId
    ? await env.DB.prepare(`
        SELECT u.*, e.employee_id, gm.mentor_user_id
        FROM group_members gm
        JOIN users u ON u.user_id = gm.user_id
        LEFT JOIN employees e ON e.user_id = u.user_id
        WHERE gm.group_id = ? AND gm.active = 1 AND u.role = ? AND u.active = 1
        ORDER BY u.created_at ASC
      `).bind(groupId, ownerRole).all()
    : await env.DB.prepare(`
        SELECT u.*, e.employee_id, NULL AS mentor_user_id
        FROM users u
        LEFT JOIN employees e ON e.user_id = u.user_id
        WHERE u.role = ? AND u.active = 1
        ORDER BY u.created_at ASC
      `).bind(ownerRole).all();

  let count = 0;
  let skippedCompleted = 0;
  let updatedExisting = 0;
  if (taskType === "Feedback" && groupId) {
    const mentees = await env.DB.prepare(`
      SELECT u.*, e.employee_id, gm.mentor_user_id
      FROM group_members gm
      JOIN users u ON u.user_id = gm.user_id
      LEFT JOIN employees e ON e.user_id = u.user_id
      WHERE gm.group_id = ? AND gm.active = 1 AND u.role = 'Mentee' AND u.active = 1
      ORDER BY u.created_at ASC
    `).bind(groupId).all();
    for (const mentee of mentees.results) {
      if (!mentee.mentor_user_id) continue;
      const result = await createOrUpdateLifecycleTask(env, {
        taskType,
        checkpointId: clean(input.checkpointId) || null,
        ownerUserId: mentee.mentor_user_id,
        employeeId: mentee.employee_id || null,
        mentorUserId: mentee.mentor_user_id,
        title: `${title} (${mentee.name})`,
        description,
        dueDate,
        groupId,
        monthNo
      });
      if (result.action === "skipped_completed") skippedCompleted += 1;
      else if (result.action === "updated_existing") updatedExisting += 1;
      else count += 1;
    }
  } else {
    for (const owner of owners.results) {
      const result = await createOrUpdateLifecycleTask(env, {
        taskType,
        checkpointId: clean(input.checkpointId) || null,
        ownerUserId: owner.user_id,
        employeeId: owner.employee_id || null,
        mentorUserId: taskType === "Feedback" ? owner.user_id : owner.mentor_user_id || null,
        title,
        description,
        dueDate,
        groupId,
        monthNo
      });
      if (result.action === "skipped_completed") skippedCompleted += 1;
      else if (result.action === "updated_existing") updatedExisting += 1;
      else count += 1;
    }
  }

  return json({ ok: true, count, updatedExisting, skippedCompleted, ownerRole, createdBy: user.user_id });
}

async function submitTask(request, env) {
  const input = await readJson(request);
  const verified = await resolveLineIdentity(env, input);
  const user = await getUserByLine(env, verified.sub);
  if (!user) throw new Error("Please register before submitting tasks.");

  const taskId = clean(input.taskId);
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE task_id = ? LIMIT 1").bind(taskId).first();
  if (!task) throw new Error("Task not found.");
  if (task.owner_user_id !== user.user_id && user.role !== "HR") throw new Error("This task does not belong to you.");
  if (task.status === "Completed") throw new Error("This task is already completed.");

  const submission = input.submission || {};
  if (task.task_type === "Feedback") {
    const requiredScores = ["understanding", "participation", "communication", "adaptability", "responsibility"];
    for (const key of requiredScores) {
      if (![2, 4, 6, 8, 10].includes(Number(submission[key]))) {
        throw new Error("Please score all feedback items.");
      }
    }
  }
  if (task.task_type === "Reflection") {
    if (!clean(submission.learnings) || !clean(submission.challenges) || !clean(submission.suggestion)) {
      throw new Error("Please complete all reflection fields.");
    }
  }

  await env.DB.prepare(`
    UPDATE tasks SET status = 'Completed', submitted_at = ?, submission_json = ?, updated_at = ?
    WHERE task_id = ?
  `).bind(nowIso(), JSON.stringify(submission), nowIso(), taskId).run();

  return json({ ok: true });
}

async function sendLineMessage(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const target = await getUserById(env, clean(input.userId));
  if (!target || !target.line_user_id) throw new Error("Target user has no LINE UserID.");
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN secret.");

  const message = clean(input.message || "Nose Tea Onboarding reminder");
  const taskId = clean(input.taskId);
  const task = await getEnrichedTaskForOwner(env, target.user_id, taskId);
  const flex = task ? taskFlexMessage(task, target) : reminderFlexMessage(message, "Open LIFF", taskId);
  const logMessage = task ? `Task Flex: ${task.task_id} ${task.title}` : message;
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to: target.line_user_id,
      messages: [flex]
    })
  });
  const responseText = await response.text();
  const logId = await nextId(env, "L");
  await env.DB.prepare(`
    INSERT INTO message_logs(log_id, target_user_id, line_user_id, message_body, status, sent_by, sent_at, error_message)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(logId, target.user_id, target.line_user_id, logMessage, response.ok ? "Sent" : "Failed", user.user_id, nowIso(), response.ok ? "" : responseText).run();

  if (!response.ok) throw new Error(`LINE push failed: ${responseText}`);
  return json({ ok: true });
}

async function sendSegmentLine(request, env) {
  const { input, user } = await requireAdmin(request, env);
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN secret.");

  const segment = clean(input.segment || "linked");
  const message = clean(input.message || "Please check your Nose Tea Onboarding tasks.");
  let sql = "SELECT * FROM users WHERE line_user_id IS NOT NULL AND active = 1";
  const binds = [];
  if (segment === "mentors") {
    sql += " AND role = ?";
    binds.push("Mentor");
  } else if (segment === "mentees") {
    sql += " AND role = ?";
    binds.push("Mentee");
  } else if (segment === "pending") {
    sql = `
      SELECT DISTINCT u.*
      FROM users u
      JOIN tasks t ON t.owner_user_id = u.user_id
      WHERE u.line_user_id IS NOT NULL AND u.active = 1 AND t.status IN ('Pending', 'Open')
    `;
  }
  sql += " LIMIT 300";
  const targets = await env.DB.prepare(sql).bind(...binds).all();

  let sent = 0;
  let failed = 0;
  for (const target of targets.results) {
    const task = await getEnrichedTaskForOwner(env, target.user_id);
    const flex = task ? taskFlexMessage(task, target) : reminderFlexMessage(message, "Open LIFF");
    const logMessage = task ? `Task Flex: ${task.task_id} ${task.title}` : message;
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: target.line_user_id,
        messages: [flex]
      })
    });
    const responseText = await response.text();
    const logId = await nextId(env, "L");
    await env.DB.prepare(`
      INSERT INTO message_logs(log_id, target_user_id, line_user_id, message_body, status, sent_by, sent_at, error_message)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(logId, target.user_id, target.line_user_id, logMessage, response.ok ? "Sent" : "Failed", user.user_id, nowIso(), response.ok ? "" : responseText).run();
    if (response.ok) sent += 1;
    else failed += 1;
  }

  return json({ ok: true, sent, failed, segment });
}

async function sendPreviewFlex(request, env) {
  const { input, user } = await requireAdmin(request, env);
  if (!user.line_user_id) throw new Error("Your admin account has no LINE UserID.");
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN secret.");

  const role = normalizeRole(input.role || "Mentor") === "Mentee" ? "Mentee" : "Mentor";
  const message = previewFlexMessage(role);
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      to: user.line_user_id,
      messages: [message]
    })
  });
  const responseText = await response.text();
  const logId = await nextId(env, "L");
  await env.DB.prepare(`
    INSERT INTO message_logs(log_id, target_user_id, line_user_id, message_body, status, sent_by, sent_at, error_message)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    logId,
    user.user_id,
    user.line_user_id,
    `Preview ${role} Flex Message`,
    response.ok ? "Sent" : "Failed",
    user.user_id,
    nowIso(),
    response.ok ? "" : responseText
  ).run();

  if (!response.ok) throw new Error(`LINE flex push failed: ${responseText}`);
  return json({ ok: true, role });
}

async function seedDemoData(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.get("key") !== "nose-tea-seed") throw new Error("Seed key required.");
  const timestamp = nowIso();
  const users = [
    ["U001", "", "HR Admin", "HR Admin", "HR", "HR", "Admin", "admin@nosetea.com"],
    ["U002", "", "Kitti P.", "Kitti P.", "Mentor", "Marketing", "Mentor", "kitti@nosetea.com"],
    ["U003", "", "Sirawat T.", "Sirawat T.", "Mentor", "R&D", "Mentor", "sirawat@nosetea.com"],
    ["U007", "", "Pimchanok S.", "Pimchanok S.", "Mentee", "Marketing", "New Hire", "pimchanok@nosetea.com"]
  ];

  for (const row of users) {
    await env.DB.prepare(`
      INSERT INTO users(user_id, line_user_id, display_name, name, role, department, position, email, active, created_at, updated_at, last_login_at)
      VALUES(?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at
    `).bind(...row, timestamp, timestamp, timestamp).run();
  }

  await env.DB.prepare(`
    INSERT INTO checkpoints(checkpoint_id, month_no, checkpoint_name, session_date, start_time, end_time, room, description, status, created_by, created_at, updated_at)
    VALUES('CP001', 1, 'Month 1 - Company Culture & Fundamentals', '2026-06-15', '10:00', '12:00', 'HQ Training Room A', 'Orientation and core onboarding session', 'Open', 'U001', ?, ?)
    ON CONFLICT(checkpoint_id) DO UPDATE SET updated_at = excluded.updated_at
  `).bind(timestamp, timestamp).run();

  await env.DB.prepare(`
    INSERT INTO tasks(task_id, task_type, checkpoint_id, owner_user_id, employee_id, mentor_user_id, title, description, status, priority, due_date, created_at, updated_at)
    VALUES('T001', 'Feedback', 'CP001', 'U002', 'E007', 'U002', 'Month 1 Feedback Form', 'Evaluate mentee onboarding progress', 'Pending', 'Normal', '2026-06-20', ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET updated_at = excluded.updated_at
  `).bind(timestamp, timestamp).run();

  return json({ ok: true, seeded: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response("", { status: 204, headers: CORS_HEADERS });

    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/api\/?/, "/");
      if (path === "/registerUser") return registerUser(request, env);
      if (path === "/webLoginExchange") return webLoginExchange(request, env);
      if (path === "/getPortal") return getPortal(request, env);
      if (path === "/getTask") return getTask(request, env);
      if (path === "/adminData") return adminData(request, env);
      if (path === "/upsertMessageTemplate") return upsertMessageTemplate(request, env);
      if (path === "/deleteMessageTemplate") return deleteMessageTemplate(request, env);
      if (path === "/createOnboardingGroup") return createOnboardingGroup(request, env);
      if (path === "/updateGroupMembers") return updateGroupMembers(request, env);
      if (path === "/adminUpdateUser") return adminUpdateUser(request, env);
      if (path === "/adminUpsertEmployee") return adminUpsertEmployee(request, env);
      if (path === "/adminImportEmployees") return adminImportEmployees(request, env);
      if (path === "/adminUnlinkEmployee") return adminUnlinkEmployee(request, env);
      if (path === "/createCheckpoint") return createCheckpoint(request, env);
      if (path === "/updateCheckpoint") return updateCheckpoint(request, env);
      if (path === "/syncGroupLifecycle") return syncGroupLifecycle(request, env);
      if (path === "/forceTasks") return forceTasks(request, env);
      if (path === "/submitTask") return submitTask(request, env);
      if (path === "/sendLineMessage") return sendLineMessage(request, env);
      if (path === "/sendSegmentLine") return sendSegmentLine(request, env);
      if (path === "/sendPreviewFlex") return sendPreviewFlex(request, env);
      if (path === "/seedDemoData") return seedDemoData(request, env);
      return json({ ok: false, error: "Not found." }, 404);
    } catch (error) {
      return json({ ok: false, error: error.message || String(error) }, 400);
    }
  }
};
