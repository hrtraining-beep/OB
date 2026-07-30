import {
  CORS_HEADERS,
  json,
  nowIso,
  clean,
  addDays,
  sha256,
  normalizeRole,
  toPublicTask,
  safeJsonParse,
  progressFromTasks,
  publicUser,
  placeholderEmail,
  readJson
} from "./lib/core.js";
import { getEnrichedTaskForOwner } from "./lib/task-queries.js";
import { reminderFlexMessage, taskFlexMessage, previewFlexMessage, sessionAnnouncementFlex, welcomeFlexMessage } from "./lib/flex.js";
// New feature modules (KPI + 360) live in their own files and receive shared helpers via `ctx`
// (see HANDOFF 0.1). They must NOT modify existing worker.js logic — additive only.
import { handleKpi } from "./lib/kpi.js";
import { handle360 } from "./lib/feedback360.js";

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

// Short-lived tokens (15 min) for first-time web registration: carry the LINE-verified
// userId from webLoginExchange so registerUser can bind the account without an idToken.
async function ensurePendingRegistrations(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS pending_registrations (token_hash TEXT PRIMARY KEY, line_user_id TEXT NOT NULL, display_name TEXT, email TEXT, expires_at TEXT NOT NULL)").run();
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

  await seedOnce(env, "seed_message_templates", "1", async () => {
    for (const row of defaults) {
      await env.DB.prepare(`
        INSERT INTO message_templates(template_id, template_key, audience, title, body, button_label, active, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(template_key) DO NOTHING
      `).bind(...row, timestamp, timestamp).run();
    }
  });
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
    "ALTER TABLE tasks ADD COLUMN month_no INTEGER",
    "ALTER TABLE tasks ADD COLUMN last_reminder_at TEXT",
    "ALTER TABLE tasks ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE tasks ADD COLUMN reminder_policy TEXT DEFAULT 'repeat_until_submitted'",
    // Which evaluation case this round belongs to. Probation rows stay NULL and keep resolving
    // by employee_id (unchanged); IDP/PIP set it, because those repeat yearly — the same employee
    // can hold several cases and "WHERE employee_id LIMIT 1" would pick one at random.
    "ALTER TABLE tasks ADD COLUMN case_id TEXT"
  ];
  for (const sql of alters) {
    try {
      await env.DB.prepare(sql).run();
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column name")) throw error;
    }
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_lifecycle ON tasks(owner_user_id, task_type, group_id, month_no, status)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_due_status ON tasks(status, due_date, last_reminder_at)").run();
}

async function ensureCheckpointLifecycle(env) {
  const alters = [
    "ALTER TABLE checkpoints ADD COLUMN group_id TEXT",
    "ALTER TABLE checkpoints ADD COLUMN last_announced_at TEXT"
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

async function ensureProbationCases(env) {
  await env.DB.prepare(`
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
      updated_at TEXT NOT NULL
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_probation_cases_employee ON probation_cases(employee_id)").run();
  const alters = [
    "ALTER TABLE probation_cases ADD COLUMN template_id TEXT",
    // NULL = 'probation' — every existing row keeps its exact meaning.
    "ALTER TABLE probation_cases ADD COLUMN program TEXT",
    // IDP/PIP are per-person: the dimensions, their weights and the metrics under them are
    // chosen when the case is opened and frozen here for its whole life. Probation keeps
    // pointing at a shared template_id and leaves this NULL.
    "ALTER TABLE probation_cases ADD COLUMN template_json TEXT",
    // When THIS case's clock starts. Probation leaves it NULL and keeps counting from the
    // employee's start_date, which is what probation means. IDP/PIP cannot: they are handed to
    // people who joined years ago, so counting Day 30 from their hire date would open every
    // round already years overdue.
    "ALTER TABLE probation_cases ADD COLUMN start_date TEXT"
  ];
  for (const sql of alters) {
    try {
      await env.DB.prepare(sql).run();
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column name")) throw error;
    }
  }
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_probation_cases_program ON probation_cases(employee_id, program, status)").run();
}

async function ensureAdminLogs(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      log_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      user_id TEXT,
      user_name TEXT,
      created_at TEXT NOT NULL
    )
  `).run();
}

async function logAdminAction(env, user, action, target, detail) {
  try {
    await ensureAdminLogs(env);
    await env.DB.prepare(`
      INSERT INTO admin_logs(log_id, action, target, detail, user_id, user_name, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), action, clean(target), clean(detail), user ? user.user_id : null, user ? clean(user.name) : null, nowIso()).run();
  } catch (e) { /* logging must never break the main action */ }
}

// Run a seed set at most once per version instead of on every request.
// (ensureAppSettings is declared further down — function declarations hoist.)
// The seeds are idempotent (ON CONFLICT DO NOTHING), so they were harmless but not free: the D1
// dashboard showed 6,814 no-op INSERTs — ~25% of ALL database runtime — writing zero rows, and the
// 60-row 360 question seed alone pushed every /360/* request to ~74 queries (Workers Free caps
// subrequests at 50). This trades that whole loop for one SELECT.
// Adding or changing a preset later: bump the version string and the set re-seeds once.
async function seedOnce(env, key, version, seedFn) {
  await ensureAppSettings(env);
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ? LIMIT 1").bind(key).first();
  if (row && String(row.value) === String(version)) return false;
  await seedFn();
  await env.DB.prepare(
    "INSERT INTO app_settings(key, value, updated_at) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(key, String(version), nowIso()).run();
  return true;
}

// Append-only archive of values that are about to be overwritten or hard-deleted.
// admin_logs answers "who changed something, when"; this answers "what was the value BEFORE".
// Auditors need the latter and D1 Time Travel only reaches back 30 days.
// NOTHING in this codebase may ever UPDATE or DELETE from this table.
async function ensureRecordArchives(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS record_archives (
      archive_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      employee_id TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      snapshot_json TEXT NOT NULL,
      actor_user_id TEXT,
      actor_name TEXT,
      archived_at TEXT NOT NULL
    )
  `).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_archives_entity ON record_archives(entity_type, entity_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_archives_employee ON record_archives(employee_id, archived_at)").run();
}

// Builds the INSERT without running it, so a caller can put it in the SAME D1 batch as the
// overwrite (batch = transaction → the old value can never be dropped while the new one lands).
// Call ensureRecordArchives(env) once before building the batch.
function archiveStmt(env, opts) {
  const o = opts || {};
  return env.DB.prepare(`
    INSERT INTO record_archives(archive_id, entity_type, entity_id, employee_id, action, reason, snapshot_json, actor_user_id, actor_name, archived_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), clean(o.entityType), clean(o.entityId), clean(o.employeeId) || null,
    clean(o.action) || "overwrite", clean(o.reason) || null, JSON.stringify(o.snapshot === undefined ? null : o.snapshot),
    o.actor ? o.actor.user_id : null, o.actor ? clean(o.actor.name) : null, nowIso()
  );
}

// Fail-CLOSED on purpose (the opposite of logAdminAction): if the old value cannot be archived,
// the caller must not go on to overwrite it — a silent hole in the archive is the exact thing
// this table exists to prevent. Archive first, write second.
async function archiveSnapshot(env, opts) {
  await ensureRecordArchives(env);
  await archiveStmt(env, opts).run();
}

async function templateInUse(env, templateId) {
  // Locked ONLY once a probation round using this template has actually been evaluated
  // (a Completed Probation task = a frozen submission exists). Being merely assigned to a
  // case — with no round evaluated yet — does NOT lock it, so HR can still fix the form
  // before any real evaluation. (Audit-safe: editing never touches frozen past results.)
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS n
    FROM tasks t
    JOIN probation_cases pc ON pc.employee_id = t.employee_id
    WHERE pc.template_id = ? AND t.task_type = 'Probation' AND t.status = 'Completed'
  `).bind(templateId).first();
  return Boolean(row && row.n > 0);
}

// One evaluation engine, three programs. Each gets its OWN task_type on purpose.
//
// The tempting alternative — keep task_type 'Probation' for all three and tell them apart by a
// program column — is a trap: ~24 queries across worker.js + app.js pair tasks with people using
// (employee_id, task_type, month_no) and know nothing about programs. Under a shared task_type,
// every one of them silently mixes IDP rounds into probation (probationExtend reading MAX(month_no)
// would see IDP's Day 120 and open a 150-day probation round; prevSubmission would prefill an IDP
// form with probation scores). Separate task_types make those same queries exclude IDP for free.
// The failure mode flips from "probation numbers quietly wrong" to "IDP missing from a screen" —
// loud, and safe. Anything that must span programs opts in explicitly via EVAL_TASK_TYPES.
const PROGRAM_TASK_TYPES = { probation: "Probation", idp: "IDP", pip: "PIP" };
const EVAL_TASK_TYPES = Object.values(PROGRAM_TASK_TYPES);
const PROGRAM_BY_TASK_TYPE = { Probation: "probation", IDP: "idp", PIP: "pip" };

const PROGRAM_LABELS = { probation: "ประเมินทดลองงาน", idp: "แผนพัฒนารายบุคคล (IDP)", pip: "แผนปรับปรุงผลงาน (PIP)" };

// NULL program / task_type in the DB means probation — every row written before IDP existed.
const programOf = value => (clean(value) || "probation").toLowerCase();
const taskTypeForProgram = program => PROGRAM_TASK_TYPES[programOf(program)] || "Probation";

// Probation has one legal shape (30/60/90), so it defaults. IDP/PIP do NOT: their length is chosen
// per person — 90 days, 120 days, a year — so there is nothing honest to default to. They must say.
const DEFAULT_ROUND_MONTHS = { probation: [1, 2, 3] };

// Rounds are config, not a constant: probation = 30/60/90, IDP = 30/60/90/120, and the deferred
// storefront phase needs a single 90-day round ([3]). Day n = month_no × 30 everywhere in the app,
// so the whole timeline/PDF/CSV stack keeps working untouched.
function roundMonthsFor(template, program) {
  const raw = template && template.round_months_json;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const months = (Array.isArray(parsed) ? parsed : []).map(Number).filter(n => Number.isInteger(n) && n > 0);
      if (months.length) return months;
    } catch (error) { /* malformed config must not strand an evaluation — fall through to default */ }
  }
  const fallback = DEFAULT_ROUND_MONTHS[programOf(program)];
  // Only probation has a default. IDP/PIP reaching here means their per-case rounds went missing —
  // inventing a timeline for them would be worse than refusing.
  if (!fallback) throw new Error("เคสนี้ยังไม่ได้ตั้งระยะเวลา/รอบประเมิน — กรุณาแจ้งผู้ดูแลระบบ");
  return fallback;
}

const milestonesFor = months => months.map(monthNo => ({ monthNo, day: monthNo * 30, offset: monthNo * 30 - 1 }));

// The rest of the app assumes one probation case per employee ("WHERE employee_id = ? LIMIT 1").
// That held while probation was the only programme — you are hired once. It breaks the moment
// IDP arrives: IDP runs every year, and a failed probation can roll straight into a PIP, so one
// employee legitimately owns several cases. Tasks therefore carry case_id and we resolve through
// it. Rows written before this column existed have case_id NULL and fall back to the old lookup,
// now narrowed by programme and ordered so it can no longer return an arbitrary row.
async function resolveEvalCase(env, task, program) {
  if (task.case_id) {
    const exact = await env.DB.prepare("SELECT * FROM probation_cases WHERE case_id = ? LIMIT 1").bind(task.case_id).first();
    if (exact) return exact;
  }
  return env.DB.prepare(`
    SELECT * FROM probation_cases
    WHERE employee_id = ? AND COALESCE(program, 'probation') = ?
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `).bind(task.employee_id, programOf(program)).first();
}

// Weights are money: they decide someone's grade. Both levels must total exactly 100 — the same
// rule as section weights, so nobody has to remember which level normalises and which does not.
// Validated here rather than only in the UI: this is what gets frozen and scored against forever.
const sumOf = list => list.reduce((s, v) => s + v, 0);

function validateCaseForm(form) {
  if (!form || typeof form !== "object") throw new Error("กรุณาตั้งเกณฑ์การประเมินก่อนเปิดเคส");
  const sections = Array.isArray(form.sections) ? form.sections : [];
  const scored = sections.filter(sec => ["kpi", "competency", "attendance"].includes(clean(sec && sec.type)));
  if (!scored.length) throw new Error("ต้องมีอย่างน้อย 1 มิติที่ให้คะแนน");

  const weights = scored.map(sec => Number(sec.weight));
  if (weights.some(w => !Number.isFinite(w) || w <= 0)) throw new Error("น้ำหนักของทุกมิติต้องเป็นตัวเลขมากกว่า 0");
  // Integers only: 33.33 × 3 never reaches 100 and would fail this check in a way nobody can fix.
  if (weights.some(w => !Number.isInteger(w))) throw new Error("น้ำหนักมิติต้องเป็นจำนวนเต็ม");
  if (sumOf(weights) !== 100) throw new Error(`น้ำหนักทุกมิติรวมกันต้องได้ 100 พอดี (ตอนนี้ได้ ${sumOf(weights)})`);

  scored.forEach(sec => {
    const items = Array.isArray(sec.items) ? sec.items : [];
    if (clean(sec.type) !== "kpi") return;
    if (!items.length) throw new Error(`มิติ "${clean(sec.title) || "-"}" ต้องมีตัววัดอย่างน้อย 1 ตัว`);
    items.forEach(item => {
      if (!clean(item && item.label)) throw new Error(`มิติ "${clean(sec.title) || "-"}" มีตัววัดที่ยังไม่ได้ตั้งชื่อ`);
    });
    // Per-item weights are optional — leaving them off means "split evenly", which is the
    // long-standing behaviour. But a half-filled set is not a choice, it is a mistake.
    const given = items.filter(item => item.weight !== undefined && item.weight !== null && item.weight !== "");
    if (!given.length) return;
    if (given.length !== items.length) throw new Error(`มิติ "${clean(sec.title) || "-"}" ตั้งน้ำหนักไม่ครบทุกตัววัด — ตั้งให้ครบ หรือไม่ต้องตั้งเลย (เฉลี่ยเท่ากัน)`);
    const itemWeights = items.map(item => Number(item.weight));
    if (itemWeights.some(w => !Number.isFinite(w) || w <= 0)) throw new Error(`มิติ "${clean(sec.title) || "-"}" มีน้ำหนักตัววัดที่ไม่ใช่ตัวเลขมากกว่า 0`);
    if (itemWeights.some(w => !Number.isInteger(w))) throw new Error(`มิติ "${clean(sec.title) || "-"}" น้ำหนักตัววัดต้องเป็นจำนวนเต็ม`);
    if (sumOf(itemWeights) !== 100) throw new Error(`มิติ "${clean(sec.title) || "-"}" น้ำหนักตัววัดรวมต้องได้ 100 พอดี (ตอนนี้ได้ ${sumOf(itemWeights)})`);
  });

  // Required, never defaulted: an IDP runs 90 days, 120 days or a year depending on the person and
  // the role they are being prepared for. Quietly handing out 30/60/90/120 because nobody picked
  // would set someone's timeline for them and read, afterwards, as if they had chosen it.
  const rounds = Array.isArray(form.roundMonths) ? form.roundMonths.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
  if (!rounds.length) throw new Error("กรุณาเลือกระยะเวลาและรอบประเมินของเคสนี้");
  const orderedRounds = [...new Set(rounds)].sort((a, b) => a - b);

  return {
    name: clean(form.name) || "แบบประเมินเฉพาะบุคคล",
    // Which position this plan is preparing them for. An IDP verdict of "พร้อม" means nothing
    // without it, and the same person can run a later IDP aimed at a different role.
    targetPosition: clean(form.targetPosition) || null,
    sections,
    ratingBands: Array.isArray(form.ratingBands) && form.ratingBands.length ? form.ratingBands : PROBATION_RATING_BANDS,
    roundMonths: orderedRounds,
    formNo: clean(form.formNo) || null,
    formRev: clean(form.formRev) || null
  };
}

// A case's own frozen form (IDP/PIP). Returns null for probation, which uses a shared template.
// A case whose snapshot is corrupt must fail loudly rather than quietly fall back to PT-C and
// score someone against a form nobody assigned them.
function parseCaseForm(probationCase) {
  const raw = probationCase && probationCase.template_json;
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`แบบประเมินของเคสนี้เสียหาย (case ${probationCase.case_id}) — กรุณาแจ้งผู้ดูแลระบบ`);
  }
  if (!parsed || !Array.isArray(parsed.sections) || !parsed.sections.length) {
    throw new Error(`แบบประเมินของเคสนี้ไม่สมบูรณ์ (case ${probationCase.case_id}) — กรุณาแจ้งผู้ดูแลระบบ`);
  }
  return parsed;
}

const PROBATION_RATING_BANDS = [
  { key: "O", label: "โดดเด่น", min: 95 },
  { key: "VG", label: "ดีมาก", min: 85 },
  { key: "G", label: "ดี", min: 75 },
  { key: "N", label: "ต้องปรับปรุง", min: 65 },
  { key: "U", label: "ไม่น่าพอใจ", min: 0 }
];

const ATTENDANCE_FIELDS = [
  { key: "absent", label: "ขาดงาน (วัน)", deduct: 5 },
  { key: "late", label: "มาสาย (ครั้ง)", deduct: 1 },
  { key: "personalLeave", label: "ลากิจ (วัน)", deduct: 1 },
  { key: "sickLeave", label: "ลาป่วย (วัน)", deduct: 0.5 },
  { key: "otherLeave", label: "ลาอื่นๆ (วัน)", deduct: 1 }
];

function probationTemplatePresets() {
  const attendanceSection = weight => ({
    type: "attendance", title: "การมาปฏิบัติงาน", weight,
    fields: ATTENDANCE_FIELDS
  });
  const comp = (weight, scale, items) => ({
    type: "competency", title: "ปัจจัยการประเมิน", weight,
    scale, minItems: 3, maxItems: items.length + 5,
    items: items.map(label => ({ label }))
  });
  const kpi = (weight, minItems) => ({
    type: "kpi", title: "หน้าที่ความรับผิดชอบหลัก", weight,
    scale: { max: 10, points: [10, 8, 6, 4, 2] },
    minItems, maxItems: 10, items: []
  });

  return [
    {
      templateId: "PT-A", name: "Form A — ระดับผู้จัดการ", level: "manager",
      ratingBands: PROBATION_RATING_BANDS,
      sections: [
        kpi(50, 5),
        comp(50, { max: 5, points: [5, 4, 3, 2, 1] }, [
          "ความคิดริเริ่ม / ความคิดสร้างสรรค์ / การริเริ่ม",
          "ความปลอดภัยในการทำงาน",
          "ความเป็นผู้นำ",
          "ทักษะด้านมนุษยสัมพันธ์ / การสื่อสาร",
          "การตัดสินใจ",
          "การวิเคราะห์ปัญหา / การตัดสินโดยอิสระ",
          "การวางแผน",
          "การประเมินและการพัฒนาพนักงาน",
          "ทัศนคติต่อการทำงานร่วมกัน / ความซื่อสัตย์",
          "การมาปฏิบัติงาน / ความตรงต่อเวลา"
        ]),
        { type: "comment", title: "ความเห็นและส่วนที่ต้องพัฒนา" }
      ]
    },
    {
      templateId: "PT-B", name: "Form B — ระดับพนักงาน (กลาง)", level: "staff",
      ratingBands: PROBATION_RATING_BANDS,
      sections: [
        kpi(50, 3),
        comp(40, { max: 4, points: [4, 3, 2, 1] }, [
          "ความรู้ในงาน",
          "คุณภาพของงาน",
          "ปริมาณ / ผลิตผลของงาน",
          "การจัดโครงสร้างของงาน",
          "มนุษยสัมพันธ์ / ทักษะการสื่อสาร",
          "ความคิดริเริ่ม / ความคิดสร้างสรรค์",
          "ความปลอดภัยในการทำงาน",
          "การทำงานเป็นทีม",
          "ทัศนคติต่อการทำงานร่วมกัน / ความซื่อสัตย์",
          "การมาปฏิบัติงาน / ความตรงต่อเวลา"
        ]),
        attendanceSection(10),
        { type: "comment", title: "ความเห็นและส่วนที่ต้องพัฒนา" }
      ]
    },
    {
      templateId: "PT-C", name: "Form C — ระดับพนักงาน (ปฏิบัติการ)", level: "operational",
      ratingBands: PROBATION_RATING_BANDS,
      sections: [
        kpi(30, 3),
        comp(30, { max: 3, points: [3, 2, 1] }, [
          "คุณภาพของงาน",
          "ความเอาใจใส่ในหน้าที่และความไว้วางใจได้",
          "การมาปฏิบัติงาน / ความตรงต่อเวลา",
          "ความซื่อสัตย์",
          "การทำงานร่วมกับผู้อื่น",
          "การปฏิบัติตามคำสั่ง",
          "ความปลอดภัยในการทำงาน",
          "การใช้และการรักษาอุปกรณ์ เครื่องมือ และทรัพย์สินของบริษัท",
          "การประพฤติตามระเบียบวินัยของบริษัท"
        ]),
        attendanceSection(40),
        { type: "comment", title: "ความเห็นและส่วนที่ต้องพัฒนา" }
      ]
    }
  ];
}

async function ensureProbationTemplates(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS probation_templates (
      template_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT,
      sections_json TEXT NOT NULL,
      rating_bands_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  const templateAlters = [
    // NULL = 'probation'. Presets PT-A/B/C stay probation-only.
    "ALTER TABLE probation_templates ADD COLUMN program TEXT",
    // NULL = the program default (probation 30/60/90 · IDP 30/60/90/120).
    "ALTER TABLE probation_templates ADD COLUMN round_months_json TEXT",
    // The company's controlled-document number, e.g. FM-HR-001 / Rev.2. HR types it in —
    // it has to match the real document register, so it can never be generated here.
    "ALTER TABLE probation_templates ADD COLUMN form_no TEXT",
    "ALTER TABLE probation_templates ADD COLUMN form_rev TEXT"
  ];
  for (const sql of templateAlters) {
    try {
      await env.DB.prepare(sql).run();
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column name")) throw error;
    }
  }
  const timestamp = nowIso();
  await seedOnce(env, "seed_probation_templates", "1", async () => {
    for (const preset of probationTemplatePresets()) {
      await env.DB.prepare(`
        INSERT INTO probation_templates(template_id, name, level, sections_json, rating_bands_json, active, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(template_id) DO NOTHING
      `).bind(preset.templateId, preset.name, preset.level, JSON.stringify(preset.sections), JSON.stringify(preset.ratingBands), timestamp, timestamp).run();
    }
  });
  try {
    await env.DB.prepare("ALTER TABLE probation_templates ADD COLUMN self_review_enabled INTEGER NOT NULL DEFAULT 0").run();
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column name")) throw error;
  }
}

// Employee self-assessment for a probation round — display-only (never affects the boss's
// pass/fail score). Keyed by the boss round's task_id; a row exists only after the employee submits.
async function ensureProbationSelfReviews(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS probation_self_reviews (
      task_id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      self_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    )
  `).run();
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
    probationRequired: ["1", "true", "yes", "y", "required"].includes(clean(record.probation_required || record.probation).toLowerCase()) ? 1 : 0,
    // KPI/360 org structure (see HANDOFF §0.1) — nullable, validated in validateEmployeeInput
    level: clean(record.level),
    rank: clean(record.rank),
    jobGroup: clean(record.job_group || record.jobgroup)
  };
}

// Nullable int in [min,max]; throws a clear error on a bad value so a bad CSV row is caught, not silently dropped.
function intInRangeOrNull(value, min, max, errMsg) {
  const s = clean(value);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(errMsg);
  return n;
}

// Adds the KPI/360 org columns to the shared employees table (nullable, non-breaking). Idempotent.
async function ensureEmployeeExtraColumns(env) {
  for (const ddl of [
    "ALTER TABLE employees ADD COLUMN level INTEGER",
    "ALTER TABLE employees ADD COLUMN rank INTEGER",
    "ALTER TABLE employees ADD COLUMN job_group TEXT"
  ]) {
    try { await env.DB.prepare(ddl).run(); }
    catch (error) { if (!String(error.message || error).includes("duplicate column name")) throw error; }
  }
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
  // KPI/360 org structure — nullable; validated only when present so old rows/imports never break.
  const level = intInRangeOrNull(input.level, 1, 5, `${prefix}level ต้องเป็นเลข 1-5`);
  const rank = intInRangeOrNull(input.rank, 1, 17, `${prefix}rank ต้องเป็นเลข 1-17`);
  const jobGroup = clean(input.jobGroup || input.job_group);
  return { employeeCode, employeeName, department, position, branch, startDate, employmentStatus, probationRequired, level, rank, jobGroup };
}

async function upsertEmployeeMaster(env, input, adminUser, source = "manual", skipExisting = false, mergeBlanks = false) {
  const data = validateEmployeeInput(input);
  await ensureEmployeeExtraColumns(env);
  const timestamp = nowIso();
  const requestedEmployeeId = clean(input.employeeId);
  const existing = requestedEmployeeId
    ? await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(requestedEmployeeId).first()
    : await env.DB.prepare("SELECT * FROM employees WHERE employee_code = ? LIMIT 1").bind(data.employeeCode).first();
  // CSV re-uploads carry the whole growing roster — only act on NEW employee codes,
  // leave already-imported (and possibly app-edited) records untouched.
  if (existing && skipExisting) {
    return { employeeId: existing.employee_id, action: "skipped" };
  }
  if (existing && existing.employee_code !== data.employeeCode) {
    const duplicate = await env.DB.prepare("SELECT employee_id FROM employees WHERE employee_code = ? LIMIT 1").bind(data.employeeCode).first();
    if (duplicate && duplicate.employee_id !== existing.employee_id) throw new Error("Employee code already exists.");
  }
  const employeeId = existing ? existing.employee_id : await nextId(env, "E");
  if (existing && mergeBlanks) {
    // CSV "update existing" mode: fill/refresh only the fields the CSV actually provides. Blank cells
    // are preserved (COALESCE) and probation/employment status are never touched (managed in-app), so a
    // re-upload can back-fill level/rank without wiping anything.
    await env.DB.prepare(`
      UPDATE employees SET
        employee_name = COALESCE(NULLIF(?, ''), employee_name),
        department = COALESCE(NULLIF(?, ''), department),
        position = COALESCE(NULLIF(?, ''), position),
        branch = COALESCE(NULLIF(?, ''), branch),
        start_date = COALESCE(NULLIF(?, ''), start_date),
        level = COALESCE(?, level),
        rank = COALESCE(?, rank),
        job_group = COALESCE(NULLIF(?, ''), job_group),
        updated_at = ?
      WHERE employee_id = ?
    `).bind(data.employeeName, data.department, data.position, data.branch, data.startDate || "", data.level, data.rank, data.jobGroup || "", timestamp, employeeId).run();
  } else if (existing) {
    await env.DB.prepare(`
      UPDATE employees
      SET employee_code = ?, employee_name = ?, department = ?, position = ?, branch = ?, start_date = ?,
          employment_status = ?, probation_required = ?, probation_status = ?,
          level = ?, rank = ?, job_group = ?, updated_at = ?
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
      data.level,
      data.rank,
      data.jobGroup || null,
      timestamp,
      employeeId
    ).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO employees(
        employee_id, user_id, employee_code, employee_name, department, position, branch, start_date,
        employment_status, created_source, current_month, progress_percent, status,
        probation_required, probation_status, level, rank, job_group, created_at, updated_at
      )
      VALUES(?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'Active', ?, ?, ?, ?, ?, ?, ?)
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
      data.level,
      data.rank,
      data.jobGroup || null,
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
      AND COALESCE(case_id, '') = COALESCE(?, '')
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(
    payload.ownerUserId,
    payload.taskType,
    payload.groupId || "",
    payload.monthNo || 0,
    payload.employeeId || "",
    payload.caseId || ""
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
    INSERT INTO tasks(task_id, task_type, checkpoint_id, owner_user_id, employee_id, mentor_user_id, title, description, status, priority, due_date, created_at, updated_at, group_id, month_no, case_id)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Normal', ?, ?, ?, ?, ?, ?)
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
    payload.monthNo || null,
    payload.caseId || null
  ).run();
  return { action: "created", taskId };
}

function addTaskSummary(summary, result) {
  if (!result) return summary;
  if (result.action === "skipped_completed") summary.skippedCompleted += 1;
  else if (result.action === "updated_existing") summary.updatedTasks += 1;
  else if (result.action === "created") summary.createdTasks += 1;
  return summary;
}

async function getLifecycleMembers(env, groupId) {
  if (!groupId) {
    const [mentees, mentors] = await Promise.all([
      env.DB.prepare(`
        SELECT u.*, e.employee_id, NULL AS mentor_user_id
        FROM users u
        LEFT JOIN employees e ON e.user_id = u.user_id
        WHERE u.role = 'Mentee' AND u.active = 1
      `).all(),
      env.DB.prepare("SELECT * FROM users WHERE role = 'Mentor' AND active = 1").all()
    ]);
    return { mentees: mentees.results, mentors: mentors.results };
  }

  const [mentees, mentors] = await Promise.all([
    env.DB.prepare(`
      SELECT u.*, e.employee_id, gm.mentor_user_id
      FROM group_members gm
      JOIN users u ON u.user_id = gm.user_id
      LEFT JOIN employees e ON e.user_id = u.user_id
      WHERE gm.group_id = ? AND gm.active = 1 AND u.role = 'Mentee' AND u.active = 1
    `).bind(groupId).all(),
    env.DB.prepare(`
      SELECT DISTINCT u.*
      FROM group_members gm
      JOIN users u ON u.user_id = COALESCE(gm.mentor_user_id, gm.user_id)
      WHERE gm.group_id = ? AND u.role = 'Mentor' AND u.active = 1
    `).bind(groupId).all()
  ]);
  return { mentees: mentees.results, mentors: mentors.results };
}

async function movePendingFeedbackOwner(env, payload) {
  if (!payload.groupId || !payload.employeeId || !payload.ownerUserId) return 0;
  const result = await env.DB.prepare(`
    UPDATE tasks
    SET owner_user_id = ?,
        mentor_user_id = ?,
        updated_at = ?
    WHERE task_type = 'Feedback'
      AND status != 'Completed'
      AND COALESCE(group_id, '') = COALESCE(?, '')
      AND COALESCE(month_no, 0) = COALESCE(?, 0)
      AND COALESCE(employee_id, '') = COALESCE(?, '')
      AND owner_user_id != ?
  `).bind(
    payload.ownerUserId,
    payload.ownerUserId,
    nowIso(),
    payload.groupId,
    payload.monthNo || 0,
    payload.employeeId,
    payload.ownerUserId
  ).run();
  return result.meta?.changes || 0;
}

async function backfillLifecycleTasksForCheckpoint(env, checkpoint) {
  await ensureTaskLifecycle(env);
  const groupId = clean(checkpoint.group_id);
  const monthNo = Number(checkpoint.month_no || 1);
  const checkpointName = clean(checkpoint.checkpoint_name) || `Month ${monthNo} Onboarding`;
  const dueDate = clean(checkpoint.session_date);
  const summary = {
    createdTasks: 0,
    updatedTasks: 0,
    skippedCompleted: 0,
    reassignedFeedback: 0,
    mentees: 0,
    mentors: 0
  };

  const { mentees, mentors } = await getLifecycleMembers(env, groupId);
  summary.mentees = mentees.length;
  summary.mentors = mentors.length;
  const mentorById = new Map(mentors.map(mentor => [mentor.user_id, mentor]));

  for (const mentee of mentees) {
    for (const taskType of ["Attendance", "Reflection"]) {
      const result = await createOrUpdateLifecycleTask(env, {
        taskType,
        checkpointId: checkpoint.checkpoint_id,
        ownerUserId: mentee.user_id,
        employeeId: mentee.employee_id || null,
        mentorUserId: mentee.mentor_user_id || null,
        title: `${checkpointName} - ${taskType}`,
        description: taskType === "Attendance" ? "Confirm onboarding session attendance." : "Submit onboarding reflection.",
        dueDate,
        groupId,
        monthNo
      });
      addTaskSummary(summary, result);
    }

    const feedbackMentors = mentors.length
      ? mentors
      : (mentee.mentor_user_id ? [mentorById.get(mentee.mentor_user_id)].filter(Boolean) : []);

    for (const mentor of feedbackMentors) {
      if (!mentors.length) {
        summary.reassignedFeedback += await movePendingFeedbackOwner(env, {
          ownerUserId: mentor.user_id,
          groupId,
          monthNo,
          employeeId: mentee.employee_id || null
        });
      }
      const result = await createOrUpdateLifecycleTask(env, {
        taskType: "Feedback",
        checkpointId: checkpoint.checkpoint_id,
        ownerUserId: mentor.user_id,
        employeeId: mentee.employee_id || null,
        mentorUserId: mentor.user_id,
        title: `${checkpointName} - Mentor Feedback (${mentee.name})`,
        description: "Evaluate assigned mentee onboarding progress.",
        dueDate,
        groupId,
        monthNo
      });
      addTaskSummary(summary, result);
    }
  }

  return summary;
}

async function resolveLineIdentity(env, input) {
  if (!input || typeof input !== "object") throw new Error("Missing LINE profile.");
  // SECURITY: never trust a raw lineUserId from the client. The LINE userId must be
  // proven by verifying the signed idToken with LINE — otherwise anyone could spoof
  // any user (including HR) by sending their lineUserId.
  const idToken = input.idToken;
  if (!idToken) throw new Error("กรุณาเข้าสู่ระบบผ่าน LINE ใหม่ (ไม่พบ identity token).");
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
  await rateLimit(env, request, "register", 12, 600);
  const input = await readJson(request);
  // Identity source: web first-time registration uses a short-lived regToken (carries the
  // LINE-verified userId from webLoginExchange); LIFF registration uses the idToken.
  const regHash = clean(input.regToken) ? await sha256(clean(input.regToken)) : null;
  let lineUserId, identityName = "", identityEmail = "";
  if (regHash) {
    await ensurePendingRegistrations(env);
    const reg = await env.DB.prepare("SELECT * FROM pending_registrations WHERE token_hash = ? AND expires_at > ?").bind(regHash, nowIso()).first();
    if (!reg) throw new Error("ลิงก์ลงทะเบียนหมดอายุ กรุณาเข้าสู่ระบบด้วย LINE ใหม่อีกครั้ง");
    lineUserId = reg.line_user_id;
    identityName = clean(reg.display_name);
    identityEmail = clean(reg.email).toLowerCase();
  } else {
    const verified = await resolveLineIdentity(env, input);
    lineUserId = verified.sub;
    identityName = clean(verified.name);
    identityEmail = clean(verified.email).toLowerCase();
  }
  const email = clean(input.email).toLowerCase();
  const role = normalizeRole(input.role);
  const name = clean(input.name || identityName);
  const department = clean(input.department);
  const position = clean(input.position);
  const employeeCode = clean(input.employeeCode);

  // Email is optional contact info now (staff may share an inbox or use a personal address).
  // Identity comes from the LINE-verified userId + employee code, never from email.
  const adminEmails = clean(env.ADMIN_EMAILS).split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  const existing = await getUserByLine(env, lineUserId);
  // A deactivated account cannot self-revive by re-registering — HR must re-enable it.
  if (existing && !existing.active) throw new Error("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อ HR");
  // SECURITY: prefer the email proven by the LINE idToken (verified.email, if email scope granted)
  // over the free-typed email. The typed email alone must never grant HR.
  //  - keep an existing HR as HR (never self-demote on re-register)
  //  - allow the ADMIN_EMAILS bootstrap ONLY when no HR exists yet (first owner)
  //  - otherwise self-registration can never become HR; the owner promotes admins manually
  const verifiedEmail = identityEmail;
  const adminCheckEmail = verifiedEmail || email;
  const hrExists = await env.DB.prepare("SELECT 1 FROM users WHERE role = 'HR' AND active = 1 LIMIT 1").first();
  // Privileged roles (HR, Executive) are GRANTED by an admin, never self-claimed at register.
  const PRIVILEGED = role === "HR" || role === "Executive";
  const finalRole = (existing && (existing.role === "HR" || existing.role === "Executive")) ? existing.role
    : (adminEmails.includes(adminCheckEmail) && !hrExists) ? "HR"
    : (PRIVILEGED ? "Mentee" : role);
  const userId = existing ? existing.user_id : await nextId(env, "U");
  const timestamp = nowIso();
  const matchedEmployee = employeeCode
    ? await env.DB.prepare("SELECT * FROM employees WHERE employee_code = ? LIMIT 1").bind(employeeCode).first()
    : null;
  // Employee code is MANDATORY for regular staff — identity MUST map to an HR-owned master record.
  // Privileged accounts (owner bootstrap / existing HR/Executive) are exempt so first-time setup isn't blocked.
  const privilegedFinal = finalRole === "HR" || finalRole === "Executive";
  if (!privilegedFinal && !employeeCode) {
    throw new Error("กรุณากรอกรหัสพนักงานที่ HR ออกให้ — จำเป็นสำหรับการลงทะเบียน");
  }
  if (employeeCode && !matchedEmployee) {
    throw new Error("รหัสพนักงานไม่ถูกต้อง กรุณาตรวจสอบรหัสกับ HR แล้วลองใหม่อีกครั้ง");
  }
  if (matchedEmployee && matchedEmployee.user_id && matchedEmployee.user_id !== userId) {
    throw new Error("รหัสพนักงานนี้ถูกผูกกับบัญชี LINE อื่นแล้ว กรุณาติดต่อ HR");
  }

  // Server-authoritative profile: when an employee code matches, the name/department/position
  // come from the HR-owned Employee Master (the typed values are ignored) so stored data can
  // never diverge from HR's records. Typed values are only used as a fallback when no code.
  const effName = matchedEmployee ? (clean(matchedEmployee.employee_name) || name) : name;
  const effDepartment = matchedEmployee ? (clean(matchedEmployee.department) || department) : department;
  const effPosition = matchedEmployee ? (clean(matchedEmployee.position) || position) : position;
  if (!effName) throw new Error("ไม่พบชื่อของคุณในข้อมูล HR กรุณาติดต่อ HR");
  if (!privilegedFinal && !effDepartment) throw new Error("ไม่พบแผนกของคุณในข้อมูล HR กรุณาติดต่อ HR");
  const emailToStore = await emailForStorage(env, email, userId);

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
    identityName || input.lineDisplayName || effName,
    effName,
    finalRole,
    effDepartment,
    effPosition,
    emailToStore,
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
  await logAdminAction(env, user, "register", userId, `${name} · ${finalRole}`);
  // Web first-time registration → log them in immediately (issue a web session).
  let webToken = null;
  if (regHash) {
    await env.DB.prepare("DELETE FROM pending_registrations WHERE token_hash = ?").bind(regHash).run();
    webToken = await createWebSession(env, userId);
  }
  return json({ ok: true, user: publicUser(user), webToken });
}

async function webLoginExchange(request, env) {
  await rateLimit(env, request, "weblogin", 15, 600);
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
  if (user && !user.active) throw new Error("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อ HR");
  if (!user) {
    // Not registered yet → issue a short-lived (15-min) registration token carrying the
    // LINE-verified userId, so the employee can register right here on the web (no phone needed).
    await ensurePendingRegistrations(env);
    const regToken = crypto.randomUUID();
    const regHash = await sha256(regToken);
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await env.DB.prepare("INSERT INTO pending_registrations(token_hash, line_user_id, display_name, email, expires_at) VALUES(?, ?, ?, '', ?) ON CONFLICT(token_hash) DO UPDATE SET line_user_id = excluded.line_user_id, display_name = excluded.display_name, expires_at = excluded.expires_at").bind(regHash, profile.userId, clean(profile.displayName), expires).run();
    return json({ ok: true, registered: false, regToken, displayName: clean(profile.displayName) });
  }
  const token = await createWebSession(env, user.user_id);
  await logAdminAction(env, user, "login", user.user_id, `เข้าสู่ระบบผ่านเว็บ (${user.role})`);
  return json({ ok: true, registered: true, token, user: publicUser(user), expiresInDays: 7 });
}

// What came back FOR this person — the other half of "what you owe", which is all the portal ever
// said. Computed live from the source tables (no feed table to drift out of sync), and every query
// is wrapped: the KPI/360 tables are created lazily by their own routes, so on a DB that has never
// opened those modules they simply do not exist yet. A missing module must cost a feature, not the
// whole portal.
//
// 🔒 360 ANONYMITY: counts only, never names. Who evaluated whom is the one thing the subject may
// never learn (locked since -47) — so this reports "3 จาก 5 คน" and never touches evaluator_user_id.
async function buildPortalFeed(env, user, probation) {
  const feed = [];
  const empId = clean(user.employee_id);
  const add = (kind, title, sub, at) => { if (at) feed.push({ kind, title, sub, at }); };

  if (empId) {
    try {
      // peer+boss only: your own SELF answers are not "someone responded about you".
      const r = await env.DB.prepare(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS done,
               MAX(CASE WHEN a.status = 'completed' THEN a.updated_at END) AS last_at
        FROM feedback_360_assignments a
        JOIN feedback_360_cycles c ON c.cycle_id = a.cycle_id
        WHERE a.subject_user_id = ? AND c.status = 'active' AND a.relation_type IN ('peer', 'boss')
      `).bind(empId).first();
      if (r && Number(r.total) > 0 && Number(r.done) > 0) {
        add("fb360_progress", `มีคนตอบแบบประเมิน 360° ของคุณแล้ว ${r.done} จาก ${r.total} คน`,
          Number(r.done) >= Number(r.total) ? "ครบทุกคนแล้ว · รอ HR สรุปผล" : "ยังรออีก " + (Number(r.total) - Number(r.done)) + " คน", r.last_at);
      }
    } catch (e) { /* 360 tables not created on this DB yet */ }

    try {
      const r = await env.DB.prepare(
        "SELECT updated_at FROM feedback_360_gap_reports WHERE subject_user_id = ? AND status = 'released' ORDER BY updated_at DESC LIMIT 1"
      ).bind(empId).first();
      if (r) add("fb360_released", "รายงาน 360° ของคุณเปิดให้ดูแล้ว", "แตะเพื่อดูผลและสิ่งที่ควรพัฒนา", r.updated_at);
    } catch (e) { /* 360 not initialised */ }
  }

  try {
    const r = await env.DB.prepare(
      "SELECT title, final_grade, approved_at FROM kpi_sub WHERE user_id = ? AND approved_at IS NOT NULL ORDER BY approved_at DESC LIMIT 3"
    ).bind(user.user_id).all();
    (r.results || []).forEach(k => add("kpi_approved", `หัวหน้าอนุมัติ KPI: ${clean(k.title)}`, `ได้เกรด ${k.final_grade} จาก 5`, k.approved_at));
  } catch (e) { /* KPI tables not created on this DB yet */ }

  // Heads see their team's side of the same loop.
  try {
    const heads = await env.DB.prepare("SELECT department FROM kpi_department_heads WHERE user_id = ?").bind(user.user_id).all();
    const depts = (heads.results || []).map(h => h.department).filter(Boolean);
    if (depts.length) {
      const marks = depts.map(() => "?").join(",");
      const r = await env.DB.prepare(
        `SELECT COUNT(*) AS n, MAX(self_submitted_at) AS last_at FROM kpi_sub
         WHERE department IN (${marks}) AND self_submitted_at IS NOT NULL AND approved_at IS NULL`
      ).bind(...depts).first();
      if (r && Number(r.n) > 0) add("kpi_pending", `ลูกทีมส่งผล KPI มาแล้ว ${r.n} รายการ`, "รอคุณอนุมัติเกรด", r.last_at);
    }
  } catch (e) { /* KPI not initialised */ }

  // Probation result rides on data getPortal already loaded — no extra query.
  if (probation && probation.result) {
    const pass = probation.result === "pass";
    const item = {
      kind: "probation_result",
      title: `ผลทดลองงานของคุณ: ${pass ? "ผ่าน" : "ไม่ผ่าน"}`,
      sub: pass ? "ยินดีด้วย 🎉" : "ติดต่อ HR เพื่อพูดคุยรายละเอียด",
      at: probation.completedAt,
      // Say it in a field, never leave the client to infer tone from the wording: "ไม่ผ่าน" ends
      // with "ผ่าน", so any endsWith/contains test reads a failure as a pass. Same trap in English
      // ("not passed"). The DB knows the answer — pass it through.
      tone: pass ? "good" : "bad"
    };
    if (item.at) feed.push(item);
  }

  return feed.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
}

async function getPortal(request, env) {
  const input = await readJson(request);
  // Accept either a LINE idToken (LIFF on phone) or a web session (PC browser) so
  // employees can use the portal on PC too. Resolve without the active-filter here so
  // we can return a distinct "disabled" state below.
  let user;
  if (input.webSessionToken) {
    user = await getUserFromWebSession(env, input.webSessionToken);
  } else {
    const verified = await resolveLineIdentity(env, input);
    user = await getUserByLine(env, verified.sub);
  }
  if (!user) return json({ ok: true, registered: false });
  if (!user.active) return json({ ok: true, registered: true, disabled: true });
  // Auth on EVERY entry (not just at register): a regular-staff account may use the portal ONLY while
  // it is still linked to an existing HR-owned Employee Master record. This bounces (a) accounts made
  // without a code (employee_id null) AND (b) accounts whose master record HR later deleted — both are
  // sent back to re-register, where a valid code is now required. Privileged (HR/Executive) are exempt.
  const privilegedUser = user.role === "HR" || user.role === "Executive";
  if (!privilegedUser) {
    const emp = user.employee_id
      ? await env.DB.prepare("SELECT employee_id FROM employees WHERE employee_id = ? LIMIT 1").bind(user.employee_id).first()
      : null;
    if (!emp) {
      return json({ ok: true, registered: false, needsEmployeeCode: true, displayName: clean(user.display_name || user.name) });
    }
  }
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

  // Employee-facing probation status (their OWN timeline). No scores/grades — status + dates only,
  // since the probation tasks are owned by the evaluator, not the employee.
  let probation = null;
  if (user.employee_id) {
    // The employee's own probation timeline — probation cases only. IDP/PIP get their own view.
    const kase = await env.DB.prepare(
      "SELECT pc.status, pc.result, pc.evaluator_user_id, pc.template_id, e.start_date, su.name AS evaluator_name " +
      "FROM probation_cases pc JOIN employees e ON e.employee_id = pc.employee_id " +
      "LEFT JOIN users su ON su.user_id = pc.evaluator_user_id " +
      "WHERE pc.employee_id = ? AND COALESCE(pc.program, 'probation') = 'probation' " +
      "ORDER BY CASE WHEN pc.status = 'active' THEN 0 ELSE 1 END, pc.updated_at DESC LIMIT 1"
    ).bind(user.employee_id).first();
    if (kase) {
      const rounds = await env.DB.prepare(
        "SELECT task_id, month_no, status, due_date FROM tasks WHERE employee_id = ? AND task_type = 'Probation'"
      ).bind(user.employee_id).all();
      const byMonth = new Map((rounds.results || []).map(r => [r.month_no, r]));
      const months = new Set([1, 2, 3]);
      (rounds.results || []).forEach(r => { if (r.month_no) months.add(r.month_no); });
      const startDate = kase.start_date || null;
      // Self-review is display-only and opt-in per template; surfaced in-app after the boss closes a round.
      // Guarded: on a fresh DB the column/table may not exist yet (created lazily by ensureProbationTemplates).
      let selfReviewEnabled = false;
      try {
        const tpl = await env.DB.prepare("SELECT self_review_enabled FROM probation_templates WHERE template_id = ? LIMIT 1").bind(kase.template_id || "PT-C").first();
        selfReviewEnabled = Boolean(tpl && tpl.self_review_enabled);
      } catch (e) { selfReviewEnabled = false; }
      let selfDone = new Set();
      if (selfReviewEnabled) {
        await ensureProbationSelfReviews(env);
        const selfRows = await env.DB.prepare("SELECT task_id FROM probation_self_reviews WHERE employee_id = ?").bind(user.employee_id).all();
        selfDone = new Set((selfRows.results || []).map(r => r.task_id));
      }
      const milestones = [...months].sort((a, b) => a - b).map(m => {
        const t = byMonth.get(m);
        const day = m * 30;
        let dueDate = t && t.due_date ? t.due_date : null;
        if (!dueDate && startDate) { try { dueDate = addDays(new Date(startDate + "T00:00:00"), day - 1).toISOString().slice(0, 10); } catch (e) { dueDate = null; } }
        const done = t && t.status === "Completed";
        return {
          day, extended: m > 3, dueDate,
          status: t ? (done ? "done" : "current") : "pending",
          taskId: t ? t.task_id : null,
          selfSubmitted: t ? selfDone.has(t.task_id) : false
        };
      });
      probation = {
        status: kase.result === "pass" ? "passed" : (kase.status || "active"),
        result: kase.result || null,
        evaluatorName: kase.evaluator_name || null,
        startDate,
        selfReviewEnabled,
        milestones,
        // when the result landed — drives the "ผลทดลองงานออกแล้ว" feed item without another query
        completedAt: kase.completed_at || kase.updated_at || null
      };
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
    onboardingGroup,
    probation,
    feed: await buildPortalFeed(env, user, probation),
    feedbackScale: await getFeedbackScale(env)
  });
}

async function getTask(request, env) {
  const input = await readJson(request);
  const user = await resolveActor(env, input);
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

  let probation = null;
  if (EVAL_TASK_TYPES.includes(task.task_type)) {
    await ensureProbationTemplates(env);
    await ensureProbationCases(env);
    const program = PROGRAM_BY_TASK_TYPE[task.task_type] || "probation";
    const probationCase = await resolveEvalCase(env, task, program);
    // IDP/PIP carry their own frozen form; probation keeps resolving a shared template by id.
    const caseForm = parseCaseForm(probationCase);
    const templateId = (probationCase && probationCase.template_id) || "PT-C";
    const template = caseForm
      ? null
      : await env.DB.prepare("SELECT * FROM probation_templates WHERE template_id = ? LIMIT 1").bind(templateId).first();
    const employee = await env.DB.prepare("SELECT employee_name, employee_code, position, department, branch, start_date FROM employees WHERE employee_id = ? LIMIT 1").bind(task.employee_id).first();
    const supervisor = probationCase && probationCase.evaluator_user_id
      ? await env.DB.prepare("SELECT name FROM users WHERE user_id = ? LIMIT 1").bind(probationCase.evaluator_user_id).first()
      : null;
    const dayNo = Number(task.month_no || 0) * 30 || null; // each round = 30 days (incl. +30 extensions)
    // The case's own clock when it has one (IDP/PIP), else the hire date — which is what
    // "Day 30 of probation" has always meant.
    const startStr = (probationCase && clean(probationCase.start_date)) || (employee ? clean(employee.start_date) : "");
    const periodEnd = startStr && dayNo ? addDays(new Date(`${startStr}T00:00:00`), dayNo - 1).toISOString().slice(0, 10) : null;
    // Carry-over must stay inside the same program AND the same case: an employee can hold a
    // probation history and an IDP case, and IDP repeats every year. Matching on employee_id
    // alone would prefill this round from a different programme's — or last year's — scores.
    const prev = await env.DB.prepare(`
      SELECT submission_json FROM tasks
      WHERE task_type = ? AND employee_id = ? AND COALESCE(month_no, 0) < ?
        AND COALESCE(case_id, '') = COALESCE(?, '')
        AND submission_json IS NOT NULL AND submission_json != ''
      ORDER BY month_no DESC LIMIT 1
    `).bind(task.task_type, task.employee_id, Number(task.month_no || 0), task.case_id || "").first();
    let prevSubmission = null;
    if (prev && prev.submission_json) {
      try { prevSubmission = JSON.parse(prev.submission_json); } catch (e) { prevSubmission = null; }
    }
    probation = {
      program,
      programLabel: PROGRAM_LABELS[program] || PROGRAM_LABELS.probation,
      template: caseForm || (template ? {
        templateId: template.template_id,
        name: template.name,
        sections: JSON.parse(template.sections_json || "[]"),
        ratingBands: JSON.parse(template.rating_bands_json || "[]"),
        formNo: template.form_no || null,
        formRev: template.form_rev || null
      } : null),
      employeeName: employee ? employee.employee_name : "",
      employeeCode: employee ? employee.employee_code : "",
      position: employee ? employee.position : "",
      department: employee ? employee.department : "",
      branch: employee ? employee.branch : "",
      startDate: startStr || null,
      periodEnd,
      supervisorName: supervisor ? supervisor.name : "",
      evaluatedAt: task.submitted_at || null,
      day: dayNo,
      prevSubmission
    };
  }
  return json({ ok: true, user: publicUser(user), task: toPublicTask(task), probation });
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

function isOwner(env, user) {
  const list = clean(env.ADMIN_EMAILS).split(",").map(v => v.trim().toLowerCase()).filter(Boolean);
  return Boolean(user && user.email && list.includes(String(user.email).toLowerCase()));
}

// READ-ONLY tier: HR or Executive. Used only by read endpoints (e.g. /execSummary).
// All mutating endpoints stay on requireAdmin (HR-only). Executives can never write.
async function requireViewer(request, env) {
  const input = await readJson(request);
  if (input.webSessionToken) {
    const webUser = await getUserFromWebSession(env, input.webSessionToken);
    if (!webUser || !webUser.active || (webUser.role !== "HR" && webUser.role !== "Executive")) {
      throw new Error("Viewer access required.");
    }
    return { input, user: webUser };
  }
  const verified = await resolveLineIdentity(env, input);
  const user = await getUserByLine(env, verified.sub);
  if (!user || !user.active || (user.role !== "HR" && user.role !== "Executive")) {
    throw new Error("Viewer access required.");
  }
  return { input, user };
}

// Executive dashboard data: AGGREGATE NUMBERS ONLY (no per-person rows ever leave the server).
// Mirrors the math in the frontend OB/Probation result summaries.
const EXEC_FB_FIELDS = [
  ["understanding", "ความเข้าใจในงาน"],
  ["participation", "การมีส่วนร่วม"],
  ["communication", "การสื่อสาร"],
  ["adaptability", "การปรับตัว"],
  ["responsibility", "ความรับผิดชอบ"]
];

async function execSummary(request, env) {
  const { user } = await requireViewer(request, env);
  const today = nowIso().slice(0, 10);
  const [emps, cases, openCnt, overdueCnt, obTasks, probTasks] = await Promise.all([
    env.DB.prepare("SELECT employee_id, department FROM employees").all(),
    // Probation stats only — an IDP case is not a probation outcome and must not be counted as one.
    env.DB.prepare("SELECT employee_id, result FROM probation_cases WHERE COALESCE(program, 'probation') = 'probation'").all(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status NOT IN ('Completed')").first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE status NOT IN ('Completed') AND due_date IS NOT NULL AND due_date <> '' AND due_date < ?").bind(today).first(),
    env.DB.prepare("SELECT employee_id, task_type, submission_json FROM tasks WHERE status = 'Completed' AND task_type IN ('Feedback','Reflection','Attendance') LIMIT 5000").all(),
    env.DB.prepare("SELECT employee_id, submission_json FROM tasks WHERE status = 'Completed' AND task_type = 'Probation' LIMIT 5000").all()
  ]);

  const empDept = new Map((emps.results || []).map(e => [e.employee_id, clean(e.department) || "ไม่ระบุแผนก"]));

  // --- Onboarding (Feedback scored; Reflection/Attendance counted) ---
  let fbCount = 0, refCount = 0, attCount = 0;
  const dimSum = {}, dimCnt = {};
  EXEC_FB_FIELDS.forEach(([k]) => { dimSum[k] = 0; dimCnt[k] = 0; });
  let pctSum = 0, pctN = 0;
  const deptOb = new Map();
  for (const t of (obTasks.results || [])) {
    if (t.task_type === "Reflection") { refCount += 1; continue; }
    if (t.task_type === "Attendance") { attCount += 1; continue; }
    fbCount += 1;
    const s = safeJsonParse(t.submission_json) || {};
    let total = 0, answered = 0;
    EXEC_FB_FIELDS.forEach(([k]) => { const v = Number(s[k] || 0); if (v) { dimSum[k] += v; dimCnt[k] += 1; total += v; answered += 1; } });
    const pct = answered ? Math.round((total / (answered * 10)) * 100) : null;
    if (pct != null) { pctSum += pct; pctN += 1; }
    const dept = empDept.get(t.employee_id) || "ไม่ระบุแผนก";
    if (!deptOb.has(dept)) deptOb.set(dept, { forms: 0, pctSum: 0, pctN: 0 });
    const d = deptOb.get(dept);
    d.forms += 1;
    if (pct != null) { d.pctSum += pct; d.pctN += 1; }
  }
  const feedbackDims = EXEC_FB_FIELDS.map(([k, label]) => ({ key: k, label, avg: dimCnt[k] ? Math.round((dimSum[k] / dimCnt[k]) * 10) / 10 : null }));
  const obByDept = [...deptOb.entries()]
    .map(([department, v]) => ({ department, feedbackForms: v.forms, overallPct: v.pctN ? Math.round(v.pctSum / v.pctN) : null }))
    .sort((a, b) => b.feedbackForms - a.feedbackForms);

  // --- Probation (frozen score/grade in submission) ---
  const grades = { O: 0, VG: 0, G: 0, N: 0, U: 0 };
  let evalCount = 0, scoreSum = 0, scoreN = 0;
  const deptProb = new Map();
  for (const t of (probTasks.results || [])) {
    const s = safeJsonParse(t.submission_json) || {};
    if (s.score == null) continue;
    evalCount += 1;
    const sc = Number(s.score);
    if (!Number.isNaN(sc)) { scoreSum += sc; scoreN += 1; }
    if (s.grade && grades[s.grade] != null) grades[s.grade] += 1;
    const dept = empDept.get(t.employee_id) || "ไม่ระบุแผนก";
    if (!deptProb.has(dept)) deptProb.set(dept, { evaluated: 0, scoreSum: 0, scoreN: 0 });
    const d = deptProb.get(dept);
    d.evaluated += 1;
    if (!Number.isNaN(sc)) { d.scoreSum += sc; d.scoreN += 1; }
  }
  let passCount = 0;
  const passByDept = new Map();
  for (const c of (cases.results || [])) {
    if (c.result === "pass") {
      passCount += 1;
      const dept = empDept.get(c.employee_id) || "ไม่ระบุแผนก";
      passByDept.set(dept, (passByDept.get(dept) || 0) + 1);
    }
  }
  const probByDept = [...deptProb.entries()]
    .map(([department, v]) => ({ department, evaluated: v.evaluated, avgScore: v.scoreN ? Math.round(v.scoreSum / v.scoreN) : null, passCount: passByDept.get(department) || 0 }))
    .sort((a, b) => b.evaluated - a.evaluated);

  return json({
    ok: true,
    currentUser: publicUser(user),
    generatedAt: nowIso(),
    kpis: {
      employees: (emps.results || []).length,
      probationActive: (cases.results || []).filter(c => c.result !== "pass").length,
      probationPassed: passCount,
      tasksOpen: (openCnt && openCnt.n) || 0,
      tasksOverdue: (overdueCnt && overdueCnt.n) || 0
    },
    onboarding: { completed: { feedback: fbCount, reflection: refCount, attendance: attCount }, feedbackDims, overallPct: pctN ? Math.round(pctSum / pctN) : null, byDept: obByDept },
    probation: { evaluated: evalCount, avgScore: scoreN ? Math.round(scoreSum / scoreN) : null, passCount, grades, byDept: probByDept }
  });
}

// adminData only powers the results summary + CSV, which need scalar fields only.
// Strip the heavy frozen Probation payload (full template + per-rubric state); the
// per-person print/eval flow loads the full submission via getTask separately.
function slimAdminSubmission(taskType, submission) {
  if (!submission || typeof submission !== "object") return submission;
  if (taskType === "Probation") {
    const { template, state, ...rest } = submission;
    return rest;
  }
  return submission;
}

async function adminData(request, env) {
  const { user } = await requireAdmin(request, env);
  const owner = isOwner(env, user);
  await ensureMessageTemplates(env);
  await ensureOnboardingGroups(env);
  await ensureTaskLifecycle(env);
  await ensureCheckpointLifecycle(env);
  await ensureProbationCases(env);
  await ensureProbationTemplates(env);
  await ensureAdminLogs(env);
  await ensureEmployeeExtraColumns(env);
  const [users, employees, importBatches, bindLogs, tasks, checkpoints, notifications, templates, groups, groupMembers, probationCases, probationTemplates, developmentCases] = await Promise.all([
    env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 200").all(),
    env.DB.prepare(`
      SELECT e.*, u.name AS linked_name, u.display_name AS linked_display_name, u.email AS linked_email, u.line_user_id AS linked_line_user_id, u.role AS linked_role
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
    `).all(),
    env.DB.prepare(`
      SELECT pc.*, e.employee_name, e.start_date, e.department, e.position, e.branch, su.name AS supervisor_name
      FROM probation_cases pc
      JOIN employees e ON e.employee_id = pc.employee_id
      LEFT JOIN users su ON su.user_id = pc.evaluator_user_id
      WHERE COALESCE(pc.program, 'probation') = 'probation'
      ORDER BY pc.updated_at DESC
      LIMIT 200
    `).all(),
    env.DB.prepare("SELECT * FROM probation_templates ORDER BY active DESC, template_id ASC").all(),
    // IDP/PIP live in the same table but are a different thing — kept as their own list so the
    // probation screens can never accidentally render them.
    env.DB.prepare(`
      SELECT pc.*, e.employee_name, e.employee_code, e.department, e.position, su.name AS supervisor_name
      FROM probation_cases pc
      JOIN employees e ON e.employee_id = pc.employee_id
      LEFT JOIN users su ON su.user_id = pc.evaluator_user_id
      WHERE COALESCE(pc.program, 'probation') IN ('idp', 'pip')
      ORDER BY pc.updated_at DESC
      LIMIT 200
    `).all()
  ]);

  return json({
    ok: true,
    currentUser: publicUser(user),
    isOwner: owner,
    feedbackScale: await getFeedbackScale(env),
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
      level: row.level,
      rank: row.rank,
      jobGroup: row.job_group,
      linkedName: row.linked_name,
      linkedDisplayName: row.linked_display_name,
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
      checkpointId: row.checkpoint_id,
      ownerUserId: row.owner_user_id,
      employeeId: row.employee_id,
      mentorUserId: row.mentor_user_id,
      status: row.status,
      dueDate: row.due_date,
      submittedAt: row.submitted_at,
      submission: slimAdminSubmission(row.task_type, safeJsonParse(row.submission_json)),
      groupId: row.group_id || null,
      monthNo: row.month_no || null,
      lastReminderAt: row.last_reminder_at || null,
      reminderCount: row.reminder_count || 0,
      reminderPolicy: row.reminder_policy || "repeat_until_submitted"
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
    probationCases: probationCases.results.map(row => {
      const start = clean(row.start_date);
      const dueOf = offset => start ? addDays(new Date(`${start}T00:00:00`), offset).toISOString().slice(0, 10) : null;
      return {
        caseId: row.case_id,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        department: row.department,
        position: row.position,
        branch: row.branch,
        startDate: start || null,
        supervisorUserId: row.evaluator_user_id,
        supervisorName: row.supervisor_name,
        templateId: row.template_id,
        status: row.status,
        result: row.result,
        notes: row.notes,
        day30Due: dueOf(29),
        day60Due: dueOf(59),
        day90Due: dueOf(89),
        activatedAt: row.activated_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at
      };
    }),
    probationTemplates: probationTemplates.results.map(row => ({
      templateId: row.template_id,
      name: row.name,
      level: row.level,
      sections: JSON.parse(row.sections_json || "[]"),
      ratingBands: JSON.parse(row.rating_bands_json || "[]"),
      active: Boolean(row.active),
      selfReviewEnabled: Boolean(row.self_review_enabled)
    })),
    developmentCases: developmentCases.results.map(row => {
      // The frozen form can be large (every dimension, metric and weight). The list only needs to
      // say what this case IS, so send a summary — the form itself arrives with getTask.
      let form = null;
      try { form = row.template_json ? JSON.parse(row.template_json) : null; } catch (error) { form = null; }
      const rounds = (form && Array.isArray(form.roundMonths)) ? form.roundMonths : [];
      return {
        caseId: row.case_id,
        program: programOf(row.program),
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        employeeCode: row.employee_code,
        department: row.department,
        position: row.position,
        targetPosition: form ? (form.targetPosition || null) : null,
        startDate: row.start_date || null,
        supervisorUserId: row.evaluator_user_id,
        supervisorName: row.supervisor_name,
        status: row.status,
        result: row.result,
        rounds,
        lastDay: rounds.length ? rounds[rounds.length - 1] * 30 : null,
        // Flagged rather than hidden: a case whose snapshot will not parse cannot be evaluated,
        // and HR needs to see that here instead of discovering it inside the form.
        formBroken: Boolean(row.template_json) && !form,
        activatedAt: row.activated_at,
        completedAt: row.completed_at,
        updatedAt: row.updated_at
      };
    }),
    // adminLogs moved to /auditList (owner-only, paged). It was fetched here on EVERY HR page load
    // — 100 rows, ~250 rows read, for one screen almost nobody opens — and capped at 100 of 146.
    adminLogs: [],
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
  await ensureTaskLifecycle(env);
  await ensureCheckpointLifecycle(env);
  const groupId = clean(input.groupId);
  const userIds = Array.isArray(input.userIds) ? input.userIds.map(clean).filter(Boolean) : [];
  const mentorUserId = clean(input.mentorUserId);
  const mentorUserIds = Array.isArray(input.mentorUserIds)
    ? input.mentorUserIds.map(clean).filter(Boolean)
    : (mentorUserId ? [mentorUserId] : []);
  if (!groupId) throw new Error("Group ID required.");
  const timestamp = nowIso();
  let added = 0;

  const removedResult = await env.DB.prepare(`
    UPDATE group_members
    SET active = 0, updated_at = ?
    WHERE group_id = ?
      AND role = 'Mentee'
      AND user_id NOT IN (${userIds.length ? userIds.map(() => "?").join(", ") : "''"})
  `).bind(timestamp, groupId, ...userIds).run();

  await env.DB.prepare(`
    UPDATE group_members
    SET active = 0, updated_at = ?
    WHERE group_id = ?
      AND role = 'Mentor'
      AND user_id NOT IN (${mentorUserIds.length ? mentorUserIds.map(() => "?").join(", ") : "''"})
  `).bind(timestamp, groupId, ...mentorUserIds).run();

  for (const mentorId of mentorUserIds) {
    const mentor = await getUserById(env, mentorId);
    if (!mentor || mentor.role !== "Mentor") continue;
    const groupMemberId = await nextId(env, "GM");
    await env.DB.prepare(`
      INSERT INTO group_members(group_member_id, group_id, user_id, role, mentor_user_id, active, created_at, updated_at)
      VALUES(?, ?, ?, 'Mentor', NULL, 1, ?, ?)
      ON CONFLICT(group_id, user_id) DO UPDATE SET
        role = 'Mentor',
        mentor_user_id = NULL,
        active = 1,
        updated_at = excluded.updated_at
    `).bind(groupMemberId, groupId, mentorId, timestamp, timestamp).run();
  }

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

  const checkpoints = await env.DB.prepare(`
    SELECT *
    FROM checkpoints
    WHERE group_id = ? AND status != 'Closed'
    ORDER BY session_date ASC, created_at ASC
  `).bind(groupId).all();

  const taskSummary = {
    createdTasks: 0,
    updatedTasks: 0,
    skippedCompleted: 0,
    reassignedFeedback: 0,
    mentees: 0,
    mentors: 0
  };
  for (const checkpoint of checkpoints.results) {
    const result = await backfillLifecycleTasksForCheckpoint(env, checkpoint);
    taskSummary.createdTasks += result.createdTasks;
    taskSummary.updatedTasks += result.updatedTasks;
    taskSummary.skippedCompleted += result.skippedCompleted;
    taskSummary.reassignedFeedback += result.reassignedFeedback;
    taskSummary.mentees = Math.max(taskSummary.mentees, result.mentees);
    taskSummary.mentors = Math.max(taskSummary.mentors, result.mentors);
  }

  return json({
    ok: true,
    added,
    removed: removedResult.meta?.changes || 0,
    activeMentees: userIds.length,
    activeMentors: mentorUserIds.length,
    openSessions: checkpoints.results.length,
    ...taskSummary
  });
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
    const result = await backfillLifecycleTasksForCheckpoint(env, {
      checkpoint_id: checkpointId,
      group_id: clean(input.groupId) || null,
      month_no: monthNo,
      checkpoint_name: clean(input.checkpointName),
      session_date: clean(input.sessionDate)
    });
    return json({ ok: true, checkpointId, ...result });
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

      const result = await backfillLifecycleTasksForCheckpoint(env, checkpoint);
      createdTasks += result.createdTasks;
      updatedTasks += result.updatedTasks + result.reassignedFeedback;
      skippedCompleted += result.skippedCompleted;
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

function bangkokDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dateDiffDays(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function shouldSendTaskReminder(task, today = bangkokDateString()) {
  if (!["Pending", "Open"].includes(task.status)) return false;
  const dueDate = clean(task.due_date || task.dueDate);
  if (!dueDate) return false;
  const lastDate = clean(task.last_reminder_at || task.lastReminderAt).slice(0, 10);
  if (lastDate === today) return false;

  const daysUntilDue = dateDiffDays(today, dueDate);
  if (daysUntilDue === null) return false;
  if (daysUntilDue === 3) return true;
  if (daysUntilDue === 0) return true;
  if (daysUntilDue < 0) {
    if (!lastDate) return true;
    const daysSinceLast = dateDiffDays(lastDate, today);
    return daysSinceLast === null || daysSinceLast >= 2;
  }
  return false;
}

async function pushFlexToLine(env, target, flex, logMessage, sentBy = "SYSTEM", taskId = "") {
  if (!target || !target.line_user_id) throw new Error("Target user has no LINE UserID.");
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN secret.");

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
  const timestamp = nowIso();
  const logId = await nextId(env, "L");
  await env.DB.prepare(`
    INSERT INTO message_logs(log_id, target_user_id, line_user_id, message_body, status, sent_by, sent_at, error_message)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    logId,
    target.user_id,
    target.line_user_id,
    logMessage,
    response.ok ? "Sent" : "Failed",
    sentBy,
    timestamp,
    response.ok ? "" : responseText
  ).run();

  if (response.ok && taskId) {
    await env.DB.prepare(`
      UPDATE tasks
      SET last_reminder_at = ?,
          reminder_count = COALESCE(reminder_count, 0) + 1,
          updated_at = ?
      WHERE task_id = ? AND status IN ('Pending', 'Open')
    `).bind(timestamp, timestamp, taskId).run();
  }

  if (!response.ok) throw new Error(`LINE push failed: ${responseText}`);
  return { ok: true, logId };
}

async function sendTaskCard(env, target, task, sentBy = "SYSTEM") {
  const taskId = task.task_id || task.taskId || "";
  return pushFlexToLine(
    env,
    target,
    taskFlexMessage(task, target),
    `Task Flex: ${taskId} ${task.title || ""}`.trim(),
    sentBy,
    taskId
  );
}

async function dispatchDueNotifications(env, options = {}) {
  await ensureTaskLifecycle(env);
  await ensureCheckpointLifecycle(env);
  const today = clean(options.today) || bangkokDateString();
  const dryRun = Boolean(options.dryRun);
  const dueTasks = await env.DB.prepare(`
    SELECT
      t.*,
      c.session_date,
      c.start_time,
      c.end_time,
      c.room,
      COALESCE(e.employee_name, eu.name) AS employee_name,
      eu.name AS target_name,
      mu.name AS mentor_name,
      u.user_id,
      u.line_user_id,
      u.name,
      u.display_name,
      u.role,
      u.active
    FROM tasks t
    JOIN users u ON u.user_id = t.owner_user_id
    LEFT JOIN checkpoints c ON c.checkpoint_id = t.checkpoint_id
    LEFT JOIN employees e ON e.employee_id = t.employee_id
    LEFT JOIN users eu ON eu.user_id = e.user_id
    LEFT JOIN users mu ON mu.user_id = t.mentor_user_id
    WHERE t.status IN ('Pending', 'Open')
      AND t.due_date IS NOT NULL
      AND u.active = 1
      AND u.line_user_id IS NOT NULL
    ORDER BY t.due_date ASC, t.created_at ASC
    LIMIT 300
  `).all();

  const selected = dueTasks.results.filter(task => shouldSendTaskReminder(task, today));
  if (dryRun) {
    return { ok: true, dryRun: true, today, candidates: dueTasks.results.length, selected: selected.length };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];
  for (const task of selected) {
    try {
      await sendTaskCard(env, task, task, "SYSTEM");
      sent += 1;
    } catch (error) {
      failed += 1;
      errors.push({ taskId: task.task_id, error: error.message || String(error) });
    }
  }
  return { ok: true, today, candidates: dueTasks.results.length, selected: selected.length, sent, failed, errors };
}

async function runDailyAutomation(request, env) {
  const { input } = await requireAdmin(request, env);
  const result = await dispatchDueNotifications(env, {
    today: clean(input.today),
    dryRun: Boolean(input.dryRun)
  });
  return json(result);
}

async function sessionRecipients(env, session) {
  const map = new Map();
  const add = rows => rows.forEach(row => { if (row.line_user_id) map.set(row.user_id, row); });
  if (session.group_id) {
    const [mentees, mentors] = await Promise.all([
      env.DB.prepare(`
        SELECT DISTINCT u.user_id, u.line_user_id, u.name
        FROM group_members gm JOIN users u ON u.user_id = gm.user_id
        WHERE gm.group_id = ? AND gm.active = 1 AND u.active = 1 AND u.line_user_id IS NOT NULL
      `).bind(session.group_id).all(),
      env.DB.prepare(`
        SELECT DISTINCT u.user_id, u.line_user_id, u.name
        FROM group_members gm JOIN users u ON u.user_id = COALESCE(gm.mentor_user_id, gm.user_id)
        WHERE gm.group_id = ? AND gm.active = 1 AND u.role = 'Mentor' AND u.active = 1 AND u.line_user_id IS NOT NULL
      `).bind(session.group_id).all()
    ]);
    add(mentees.results);
    add(mentors.results);
  }
  // HR admins always informed
  const hr = await env.DB.prepare("SELECT user_id, line_user_id, name FROM users WHERE role = 'HR' AND active = 1 AND line_user_id IS NOT NULL").all();
  add(hr.results);
  return [...map.values()];
}

async function dispatchSessionAnnouncements(env, options = {}) {
  await ensureCheckpointLifecycle(env);
  await ensureOnboardingGroups(env);
  const today = clean(options.today) || bangkokDateString();
  const tomorrow = addDays(new Date(`${today}T00:00:00Z`), 1).toISOString().slice(0, 10);
  const dryRun = Boolean(options.dryRun);

  const sessions = await env.DB.prepare(`
    SELECT * FROM checkpoints
    WHERE status != 'Closed' AND session_date IS NOT NULL
      AND session_date >= ? AND session_date <= ?
    ORDER BY session_date ASC
    LIMIT 100
  `).bind(today, tomorrow).all();

  let sent = 0;
  let failed = 0;
  let sessionsNotified = 0;
  let candidates = 0;
  for (const session of sessions.results) {
    if (clean(session.last_announced_at).slice(0, 10) === today) continue;
    candidates += 1;
    const recipients = await sessionRecipients(env, session);
    if (!recipients.length) continue;
    if (dryRun) { sessionsNotified += 1; continue; }
    let any = false;
    for (const target of recipients) {
      try {
        await pushFlexToLine(env, target, sessionAnnouncementFlex(session), `Session: ${session.checkpoint_name || session.checkpoint_id}`, "SYSTEM", "");
        sent += 1; any = true;
      } catch (error) { failed += 1; }
    }
    await env.DB.prepare("UPDATE checkpoints SET last_announced_at = ? WHERE checkpoint_id = ?").bind(nowIso(), session.checkpoint_id).run();
    if (any) sessionsNotified += 1;
  }
  return { ok: true, today, candidates, sessionsNotified, sent, failed, dryRun };
}

// Force-announce ONE checkpoint to its group + HR, regardless of date window / dedup.
// Used for reschedule notices (HR moved a session date earlier/later).
async function announceSessionNow(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureCheckpointLifecycle(env);
  const checkpointId = clean(input.checkpointId);
  if (!checkpointId) throw new Error("checkpointId is required.");
  const session = await env.DB.prepare("SELECT * FROM checkpoints WHERE checkpoint_id = ? LIMIT 1").bind(checkpointId).first();
  if (!session) throw new Error("Session not found.");
  const recipients = await sessionRecipients(env, session);
  let sent = 0, failed = 0;
  for (const target of recipients) {
    try {
      await pushFlexToLine(env, target, sessionAnnouncementFlex(session), `Session: ${session.checkpoint_name || session.checkpoint_id}`, "SYSTEM", "");
      sent += 1;
    } catch (error) { failed += 1; }
  }
  await env.DB.prepare("UPDATE checkpoints SET last_announced_at = ? WHERE checkpoint_id = ?").bind(nowIso(), checkpointId).run();
  await logAdminAction(env, user, "session_announce", checkpointId, `${session.checkpoint_name || checkpointId} · ผู้รับ ${recipients.length} · ส่ง ${sent}`);
  return json({ ok: true, recipients: recipients.length, sent, failed });
}

async function runSessionAnnouncements(request, env) {
  const { input } = await requireAdmin(request, env);
  const result = await dispatchSessionAnnouncements(env, { today: clean(input.today), dryRun: Boolean(input.dryRun) });
  return json(result);
}

async function adminUpdateUser(request, env) {
  const { input, user: actor } = await requireAdmin(request, env);
  const userId = clean(input.userId);
  const existing = await getUserById(env, userId);
  if (!existing) throw new Error("User not found.");

  const name = clean(input.name);
  const department = clean(input.department);
  const email = clean(input.email).toLowerCase();
  const role = normalizeRole(input.role);
  if (!name) throw new Error("Name is required.");
  if (!department) throw new Error("Department is required.");
  // Email optional + free-form (shared inbox / gmail / none all OK). Owner email is still
  // protected below so the system owner can't be locked out.
  // Protect the system owner: cannot be demoted, deactivated, or have email changed away from owner list.
  if (isOwner(env, existing)) {
    if (role !== "HR") throw new Error("ไม่สามารถเปลี่ยน Role ของเจ้าของระบบได้");
    if (input.active === false || input.active === "0" || input.active === 0) throw new Error("ไม่สามารถปิดใช้งานเจ้าของระบบได้");
    if (!isOwner(env, { email })) throw new Error("ไม่สามารถเปลี่ยนอีเมลของเจ้าของระบบได้");
  }

  const timestamp = nowIso();
  const emailToStore = await emailForStorage(env, email, userId);
  await env.DB.prepare(`
    UPDATE users
    SET name = ?, role = ?, department = ?, position = ?, email = ?, active = ?, updated_at = ?
    WHERE user_id = ?
  `).bind(
    name,
    role,
    department,
    clean(input.position),
    emailToStore,
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

  if (existing.role !== role) {
    await logAdminAction(env, actor, "user_role_change", userId, `${clean(existing.name)}: ${existing.role} → ${role}`);
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

// Link an existing user account to a Master Data employee record (the reverse of unlink).
// Used so a bootstrap HR account can adopt its real employee identity WITHOUT deleting itself
// (deleting the only HR = permanent lockout). Role is preserved; name/department/position become
// server-authoritative from the master (same rule as registration).
async function adminLinkEmployee(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const userId = clean(input.userId);
  const employeeId = clean(input.employeeId);
  if (!userId || !employeeId) throw new Error("ต้องระบุ userId และ employeeId");
  const targetUser = await getUserById(env, userId);
  if (!targetUser) throw new Error("ไม่พบผู้ใช้");
  const employee = await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(employeeId).first();
  if (!employee) throw new Error("ไม่พบพนักงานใน Master Data");
  if (employee.user_id && employee.user_id !== userId) throw new Error("พนักงานคนนี้ถูกผูกกับบัญชี LINE อื่นแล้ว — ยกเลิกผูกก่อน");
  const timestamp = nowIso();
  // release any employee record this user was previously bound to (a user maps to one master row)
  await env.DB.prepare("UPDATE employees SET user_id = NULL, updated_at = ? WHERE user_id = ? AND employee_id != ?").bind(timestamp, userId, employeeId).run();
  await env.DB.prepare("UPDATE employees SET user_id = ?, updated_at = ? WHERE employee_id = ?").bind(userId, timestamp, employeeId).run();
  // server-authoritative profile from master; role/email are NOT touched (keeps HR)
  await env.DB.prepare(`UPDATE users SET employee_id = ?,
      name = COALESCE(NULLIF(?, ''), name),
      department = COALESCE(NULLIF(?, ''), department),
      position = COALESCE(NULLIF(?, ''), position),
      updated_at = ? WHERE user_id = ?`)
    .bind(employeeId, clean(employee.employee_name), clean(employee.department), clean(employee.position), timestamp, userId).run();
  await env.DB.prepare(`
    INSERT INTO line_bind_logs(log_id, employee_id, user_id, old_line_user_id, new_line_user_id, action, reason, created_by, created_at)
    VALUES(?, ?, ?, NULL, ?, 'link', ?, ?, ?)
  `).bind(crypto.randomUUID(), employeeId, userId, targetUser.line_user_id || null, clean(input.reason || "admin_link"), user.user_id, timestamp).run();
  await logAdminAction(env, user, "user_link_employee", userId, `${clean(employee.employee_code)} ${clean(employee.employee_name)}`);
  const updated = await getUserById(env, userId);
  return json({ ok: true, user: publicUser(updated) });
}

// Hard-delete a user: unbind any employee, drop their group memberships + mentor row,
// then remove the user row. Owner is protected. Their LINE can re-register fresh later.
async function adminDeleteUser(request, env) {
  const { input, user: actor } = await requireAdmin(request, env);
  const userId = clean(input.userId);
  const existing = await getUserById(env, userId);
  if (!existing) throw new Error("User not found.");
  if (isOwner(env, existing)) throw new Error("ลบบัญชีเจ้าของระบบไม่ได้");
  if (existing.user_id === actor.user_id) throw new Error("ลบบัญชีตัวเองไม่ได้");
  const timestamp = nowIso();
  await env.DB.prepare("UPDATE employees SET user_id = NULL, updated_at = ? WHERE user_id = ?").bind(timestamp, userId).run();
  // Clear FK references to users(user_id) first, else the final DELETE trips
  // "FOREIGN KEY constraint failed" (line_bind_logs.user_id, probation_cases.evaluator_user_id).
  await env.DB.prepare("UPDATE probation_cases SET evaluator_user_id = NULL, updated_at = ? WHERE evaluator_user_id = ?").bind(timestamp, userId).run();
  await env.DB.prepare("DELETE FROM line_bind_logs WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM group_members WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM mentors WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM web_sessions WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM users WHERE user_id = ?").bind(userId).run();
  await logAdminAction(env, actor, "user_delete", userId, `${clean(existing.name)} · ${existing.role} · ${clean(existing.email)}`);
  return json({ ok: true });
}

// Snapshot everything that carries an evaluation RESULT for one employee before a hard delete.
// One archive row per purge event (the natural audit unit: "employee X was purged, here is
// everything that was destroyed"). Tables the 360 module owns may not exist → tolerated per table.
async function archiveEmployeePurge(env, employee, actor) {
  const employeeId = clean(employee.employee_id);
  const grab = async (sql, ...binds) => {
    try { const r = await env.DB.prepare(sql).bind(...binds).all(); return r.results || []; }
    catch (e) { return { error: String(e.message || e) }; }
  };
  const snapshot = {
    employee,
    completedTasks: await grab("SELECT * FROM tasks WHERE employee_id = ? AND status = 'Completed'", employeeId),
    probationCase: await grab("SELECT * FROM probation_cases WHERE employee_id = ?", employeeId),
    selfReviews: await grab("SELECT * FROM probation_self_reviews WHERE employee_id = ?", employeeId),
    feedback360Responses: await grab(
      "SELECT r.*, a.cycle_id, a.relation_type, a.evaluator_user_id, a.subject_user_id FROM feedback_360_responses r " +
      "JOIN feedback_360_assignments a ON a.assignment_id = r.assignment_id WHERE a.evaluator_user_id = ? OR a.subject_user_id = ?", employeeId, employeeId),
    feedback360Reports: await grab("SELECT * FROM feedback_360_gap_reports WHERE subject_user_id = ?", employeeId),
    kpiSubs: await grab("SELECT * FROM kpi_sub WHERE user_id IN (SELECT user_id FROM users WHERE employee_id = ?)", employeeId)
  };
  await archiveSnapshot(env, {
    entityType: "employee_purge", entityId: employeeId, employeeId,
    action: "delete", reason: `ลบพนักงาน ${clean(employee.employee_name)} · ${clean(employee.employee_code)}`,
    snapshot, actor
  });
}

// Hard-delete an employee (master record) + everything tied to them: probation case,
// onboarding/probation tasks, bind logs; and unlink any user. Use for cleaning test data.
async function adminDeleteEmployee(request, env) {
  const { input, user: actor } = await requireAdmin(request, env);
  const employeeId = clean(input.employeeId);
  const employee = await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(employeeId).first();
  if (!employee) throw new Error("Employee not found.");
  // Audit: this wipes frozen evaluation results for good — archive them first (throws = no delete).
  await archiveEmployeePurge(env, employee, actor);
  const timestamp = nowIso();
  // Unlink any user + clear all FK references to employees(employee_id) before the final DELETE.
  await env.DB.prepare("UPDATE users SET employee_id = NULL, updated_at = ? WHERE employee_id = ?").bind(timestamp, employeeId).run();
  await env.DB.prepare("DELETE FROM tasks WHERE employee_id = ?").bind(employeeId).run();
  await env.DB.prepare("DELETE FROM probation_cases WHERE employee_id = ?").bind(employeeId).run();
  await env.DB.prepare("DELETE FROM line_bind_logs WHERE employee_id = ?").bind(employeeId).run();
  // 360 rows are keyed by employee_id (as evaluator or subject). Clean responses → assignments →
  // gap reports so no orphans remain. try/catch: tables may not exist on a DB that never ran 360.
  try {
    await env.DB.prepare("DELETE FROM feedback_360_responses WHERE assignment_id IN (SELECT assignment_id FROM feedback_360_assignments WHERE evaluator_user_id = ? OR subject_user_id = ?)").bind(employeeId, employeeId).run();
    await env.DB.prepare("DELETE FROM feedback_360_assignments WHERE evaluator_user_id = ? OR subject_user_id = ?").bind(employeeId, employeeId).run();
    await env.DB.prepare("DELETE FROM feedback_360_gap_reports WHERE subject_user_id = ?").bind(employeeId).run();
  } catch (e) { /* 360 not initialized on this DB */ }
  await env.DB.prepare("DELETE FROM employees WHERE employee_id = ?").bind(employeeId).run();
  await logAdminAction(env, actor, "employee_delete", employeeId, `${clean(employee.employee_name)} · ${clean(employee.employee_code)}`);
  return json({ ok: true });
}

// Delete an onboarding group + everything tied to it (group_id is a plain column, not an enforced
// FK, so clear members/checkpoints/tasks first to avoid orphans). HR-only + audited.
async function deleteOnboardingGroup(request, env) {
  const { input, user: actor } = await requireAdmin(request, env);
  const groupId = clean(input.groupId);
  const group = await env.DB.prepare("SELECT * FROM onboarding_groups WHERE group_id = ? LIMIT 1").bind(groupId).first();
  if (!group) throw new Error("Group not found.");
  // Audit: submitted feedback/reflection forms die with the group — archive them first.
  const doneTasks = await env.DB.prepare("SELECT * FROM tasks WHERE group_id = ? AND status = 'Completed'").bind(groupId).all();
  if ((doneTasks.results || []).length) {
    await archiveSnapshot(env, {
      entityType: "group_purge", entityId: groupId, employeeId: null, action: "delete",
      reason: `ลบกลุ่ม ${clean(group.group_name)}`,
      snapshot: { group, completedTasks: doneTasks.results }, actor
    });
  }
  await env.DB.prepare("DELETE FROM tasks WHERE group_id = ?").bind(groupId).run();
  await env.DB.prepare("DELETE FROM checkpoints WHERE group_id = ?").bind(groupId).run();
  await env.DB.prepare("DELETE FROM group_members WHERE group_id = ?").bind(groupId).run();
  await env.DB.prepare("DELETE FROM onboarding_groups WHERE group_id = ?").bind(groupId).run();
  await logAdminAction(env, actor, "group_delete", groupId, clean(group.group_name));
  return json({ ok: true });
}

async function adminImportEmployees(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const csvText = String(input.csvText || "");
  const fileName = clean(input.fileName || "employee-import.csv").slice(0, 120);
  // When true, existing employees are UPDATED (merge non-empty fields) instead of skipped — used to
  // back-fill level/rank into staff already in the DB. Default off = safe "add new only".
  const updateExisting = input.updateExisting === true || input.updateExisting === 1 || String(input.updateExisting).toLowerCase() === "true" || input.updateExisting === "1";
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
      const result = await upsertEmployeeMaster(env, validated, user, "csv", !updateExisting, updateExisting);
      if (result.action === "created") newRows += 1;
      else if (result.action === "skipped") skippedRows += 1;
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
    const { mentees, mentors } = await getLifecycleMembers(env, groupId);
    const mentorById = new Map(mentors.map(mentor => [mentor.user_id, mentor]));
    for (const mentee of mentees) {
      const feedbackMentors = mentors.length
        ? mentors
        : (mentee.mentor_user_id ? [mentorById.get(mentee.mentor_user_id)].filter(Boolean) : []);
      for (const mentor of feedbackMentors) {
        const result = await createOrUpdateLifecycleTask(env, {
          taskType,
          checkpointId: clean(input.checkpointId) || null,
          ownerUserId: mentor.user_id,
          employeeId: mentee.employee_id || null,
          mentorUserId: mentor.user_id,
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

async function assignProbationSupervisor(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureProbationCases(env);
  await ensureTaskLifecycle(env);
  const employeeId = clean(input.employeeId);
  const supervisorUserId = clean(input.supervisorUserId);
  const templateId = clean(input.templateId) || "PT-C";
  const program = programOf(input.program);
  if (!PROGRAM_TASK_TYPES[program]) throw new Error("Unknown programme.");
  const taskType = taskTypeForProgram(program);
  if (!employeeId || !supervisorUserId) throw new Error("employeeId and supervisorUserId are required.");
  const employee = await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(employeeId).first();
  if (!employee) throw new Error("Employee not found.");
  const supervisor = await getUserById(env, supervisorUserId);
  if (!supervisor) throw new Error("Supervisor not found.");
  const timestamp = nowIso();

  // IDP/PIP forms are built per person and frozen for the life of the case (the dimensions and
  // their weights are chosen for this individual and must not move under a running evaluation).
  const caseForm = program === "probation" ? null : validateCaseForm(input.form);

  // Scoped to the programme: an IDP assignment must not find (and overwrite) a probation case.
  const existing = await env.DB.prepare(`
    SELECT * FROM probation_cases
    WHERE employee_id = ? AND COALESCE(program, 'probation') = ?
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `).bind(employeeId, program).first();
  // Audit guard: once a round has been evaluated, the bound form must not change (clone instead).
  // Scoped to this programme's task type — an evaluated IDP round must not freeze the probation form.
  if (existing && clean(existing.template_id) && clean(existing.template_id) !== templateId) {
    const done = await env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE task_type = ? AND employee_id = ? AND status = 'Completed'").bind(taskType, employeeId).first();
    if (done && done.n > 0) throw new Error("เริ่มประเมินไปแล้ว เปลี่ยนฟอร์มไม่ได้ (เพื่อความเป็นธรรม) — กรุณาคัดลอกฟอร์มเป็นเวอร์ชันใหม่แทน");
  }
  // The per-case form is frozen at the first assignment and never re-written afterwards:
  // re-assigning a supervisor mid-IDP must not silently re-cut the criteria underneath it.
  if (existing && caseForm && clean(existing.template_json)) {
    throw new Error("เคสนี้ตั้งเกณฑ์ไว้แล้ว แก้ภายหลังไม่ได้ — ถ้าต้องแก้จริง ให้ปิดเคสแล้วเปิดใหม่");
  }
  const startDate = program === "probation"
    ? clean(employee.start_date)
    : (clean(input.startDate) || (existing && clean(existing.start_date)) || timestamp.slice(0, 10));

  let caseId;
  if (existing) {
    caseId = existing.case_id;
    await env.DB.prepare(`
      UPDATE probation_cases
      SET evaluator_user_id = ?,
          template_id = ?,
          program = ?,
          template_json = COALESCE(template_json, ?),
          start_date = COALESCE(start_date, ?),
          status = CASE WHEN status = 'completed' THEN status ELSE 'active' END,
          activated_at = COALESCE(activated_at, ?),
          activated_by = COALESCE(activated_by, ?),
          updated_at = ?
      WHERE case_id = ?
    `).bind(
      supervisorUserId, templateId, program,
      caseForm ? JSON.stringify(caseForm) : null,
      program === "probation" ? null : startDate,
      timestamp, user.user_id, timestamp, caseId
    ).run();
  } else {
    caseId = await nextId(env, "PC");
    await env.DB.prepare(`
      INSERT INTO probation_cases(case_id, employee_id, evaluator_user_id, template_id, program, template_json, start_date, status, activated_at, activated_by, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).bind(
      caseId, employeeId, supervisorUserId, templateId, program,
      caseForm ? JSON.stringify(caseForm) : null,
      program === "probation" ? null : startDate,
      timestamp, user.user_id, timestamp, timestamp
    ).run();
  }

  // 🔴 Probation only. probation_required/probation_status are what the app uses to say
  // "this person is serving a probation" — handing a Senior Manager an IDP must not brand them
  // as being on probation, which is both wrong and, to them, insulting.
  if (program === "probation") {
    await env.DB.prepare(`
      UPDATE employees
      SET probation_required = 1, probation_status = 'active',
          probation_activated_at = COALESCE(probation_activated_at, ?),
          probation_activated_by = COALESCE(probation_activated_by, ?),
          updated_at = ?
      WHERE employee_id = ?
    `).bind(timestamp, user.user_id, timestamp, employeeId).run();
  }

  const template = await env.DB.prepare("SELECT * FROM probation_templates WHERE template_id = ? LIMIT 1").bind(templateId).first();
  const rounds = roundMonthsFor(caseForm ? { round_months_json: JSON.stringify(caseForm.roundMonths || null) } : template, program);
  const start = startDate;
  const label = PROGRAM_LABELS[program] || PROGRAM_LABELS.probation;
  let createdTasks = 0;
  for (const milestone of milestonesFor(rounds)) {
    const dueDate = start ? addDays(new Date(`${start}T00:00:00`), milestone.offset).toISOString().slice(0, 10) : null;
    const result = await createOrUpdateLifecycleTask(env, {
      taskType,
      ownerUserId: supervisorUserId,
      employeeId,
      caseId,
      mentorUserId: supervisorUserId,
      title: `${label} ${milestone.day} วัน - ${employee.employee_name}`,
      description: `แบบ${label}รอบ ${milestone.day} วัน`,
      dueDate,
      monthNo: milestone.monthNo
    });
    if (result.action === "created") createdTasks += 1;
  }
  await logAdminAction(env, user, "probation_assign", employeeId, `${employee.employee_name} · ${label} · หัวหน้า ${supervisor.name || supervisorUserId} · ฟอร์ม ${caseForm ? "เฉพาะเคส" : templateId}`);
  return json({ ok: true, caseId, createdTasks, program });
}

async function updateProbationCase(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureProbationCases(env);
  const caseId = clean(input.caseId);
  if (!caseId) throw new Error("caseId is required.");
  const status = clean(input.status);
  const result = clean(input.result);
  const notes = clean(input.notes);
  const timestamp = nowIso();
  const completedAt = status === "completed" ? timestamp : null;
  await env.DB.prepare(`
    UPDATE probation_cases
    SET status = COALESCE(NULLIF(?, ''), status),
        result = COALESCE(NULLIF(?, ''), result),
        notes = COALESCE(NULLIF(?, ''), notes),
        completed_at = COALESCE(?, completed_at),
        updated_at = ?
    WHERE case_id = ?
  `).bind(status, result, notes, completedAt, timestamp, caseId).run();
  if (status === "completed" || result) {
    const probationCase = await env.DB.prepare("SELECT employee_id FROM probation_cases WHERE case_id = ? LIMIT 1").bind(caseId).first();
    if (probationCase) {
      await env.DB.prepare("UPDATE employees SET probation_status = ?, updated_at = ? WHERE employee_id = ?")
        .bind(status === "completed" ? "completed" : "active", timestamp, probationCase.employee_id).run();
    }
  }
  await logAdminAction(env, user, "probation_result", caseId, `${status || '-'}${result ? ' · ' + result : ''}`);
  return json({ ok: true });
}

// HR override: mark probation PASSED without the in-app evaluation flow — for staff who already
// passed before the app existed (or were evaluated on paper). No supervisor / eval rounds required,
// so their case stops sitting in the pending queue forever. Audited distinctly.
async function overrideProbationPass(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureProbationCases(env);
  const employeeId = clean(input.employeeId);
  if (!employeeId) throw new Error("employeeId is required.");
  const employee = await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(employeeId).first();
  if (!employee) throw new Error("Employee not found.");
  const timestamp = nowIso();
  const note = clean(input.note) || "ผ่านทดลองงานนอกระบบ (บันทึกโดย HR)";
  // Probation-scoped: "mark as passed probation" must never land on this person's IDP/PIP case
  // and close it as passed.
  const existing = await env.DB.prepare(`
    SELECT case_id FROM probation_cases
    WHERE employee_id = ? AND COALESCE(program, 'probation') = 'probation'
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `).bind(employeeId).first();
  if (existing) {
    await env.DB.prepare("UPDATE probation_cases SET status = 'completed', result = 'pass', notes = ?, completed_at = ?, updated_at = ? WHERE case_id = ?")
      .bind(note, timestamp, timestamp, existing.case_id).run();
  } else {
    const caseId = await nextId(env, "PC");
    await env.DB.prepare(`
      INSERT INTO probation_cases(case_id, employee_id, evaluator_user_id, template_id, status, result, notes, activated_at, activated_by, completed_at, created_at, updated_at)
      VALUES(?, ?, NULL, NULL, 'completed', 'pass', ?, ?, ?, ?, ?, ?)
    `).bind(caseId, employeeId, note, timestamp, user.user_id, timestamp, timestamp, timestamp).run();
  }
  await env.DB.prepare("UPDATE employees SET probation_status = 'completed', updated_at = ? WHERE employee_id = ?").bind(timestamp, employeeId).run();
  await logAdminAction(env, user, "probation_override_pass", employeeId, `${employee.employee_name} · ${note}`);
  return json({ ok: true });
}

// Owner-only full-data snapshot for offline backup (the user's IT blocks wrangler/Node, so backup
// must be doable from the browser). Returns every business table as JSON — archive it on disk; a dev
// can restore from it later. Table names are hardcoded literals (not user input) so the interpolation
// is safe. Ephemeral/secret tables (web_sessions, rate_limits, pending_registrations) are excluded.
async function exportBackup(request, env) {
  const { user } = await requireAdmin(request, env);
  if (!isOwner(env, user)) throw new Error("เฉพาะเจ้าของระบบเท่านั้นที่สำรองข้อมูลได้");
  // Ask the database what exists instead of maintaining a hand-written list. A list has to be
  // remembered; this cannot be forgotten. The old list missed 7 of 36 tables — including `counters`,
  // which nextId() reads: restoring without it restarts every sequence at 0 and hands out IDs that
  // already exist. New tables (KPI, 360, whatever comes next) now land in the backup on their own.
  // Excluded on purpose: session/rate-limit/registration-token rows are short-lived, and there is no
  // reason to put session token hashes in a file on someone's laptop.
  const EPHEMERAL = new Set(["web_sessions", "rate_limits", "pending_registrations"]);
  const listed = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
  ).all();
  const tables = (listed.results || []).map(r => r.name).filter(n => !EPHEMERAL.has(n));
  const dump = {};
  const failed = [];
  for (const t of tables) {
    // Table name comes from sqlite_master (not user input), so interpolating it is safe here —
    // SQLite cannot bind an identifier as a parameter.
    try { const r = await env.DB.prepare(`SELECT * FROM ${t}`).all(); dump[t] = r.results || []; }
    catch (e) { dump[t] = { error: String(e.message || e) }; failed.push(t); }
  }
  // Ship the manifest with the file: a backup you cannot verify is a backup you are only assuming.
  return json({
    ok: true,
    exportedAt: nowIso(),
    database: "nose-tea-onboarding",
    manifest: {
      tableCount: tables.length,
      tables,
      rowCounts: tables.reduce((a, t) => { a[t] = Array.isArray(dump[t]) ? dump[t].length : null; return a; }, {}),
      excluded: [...EPHEMERAL],   // named, so "missing" is always a decision and never an accident
      failed
    },
    tables: dump
  });
}

// Paging for the two audit-facing lists (record_archives + admin_logs). Both are append-only and
// grow forever — a bulk assign of 300 people writes 300 admin_logs rows in one day — so a flat
// "LIMIT n" would silently hide history on exactly the pages an auditor has to trust. Every page
// reports `total` so the UI can say "showing X of Y" and offer more, instead of quietly stopping.
const AUDIT_PAGE_MAX = 200;
function pageArgs(input) {
  const limit = Math.min(Math.max(Number(input.limit) || 100, 1), AUDIT_PAGE_MAX);
  const offset = Math.max(Number(input.offset) || 0, 0);
  return { limit, offset };
}
// LIKE with the wildcards in the bound value (never concatenated into SQL). `%` / `_` typed by the
// user act as wildcards; harmless for a search box, and it keeps the statement parameterised.
function likeBinds(q, columns) {
  if (!q) return { sql: "", binds: [] };
  return { sql: "(" + columns.map(c => `${c} LIKE ?`).join(" OR ") + ")", binds: columns.map(() => `%${q}%`) };
}

// Owner-only reader for the append-only archive. Owner-only (not HR) to match the audit log:
// these snapshots hold raw pre-edit values, including 360 answers WITH their evaluator — which
// the anonymity model never exposes to anyone but the system owner.
// Split in two endpoints so the list stays cheap: it ships sizes, never snapshot_json itself
// (an employee_purge snapshot carries every frozen evaluation that employee ever had).
async function archiveList(request, env) {
  const { input, user } = await requireAdmin(request, env);
  if (!isOwner(env, user)) throw new Error("เฉพาะเจ้าของระบบเท่านั้นที่ดูคลังค่าก่อนแก้ไขได้");
  await ensureRecordArchives(env);
  const { limit, offset } = pageArgs(input);
  const employeeId = clean(input.employeeId);
  const entityType = clean(input.entityType);
  const search = likeBinds(clean(input.q), ["a.reason", "a.actor_name", "e.employee_name", "e.employee_code"]);
  const wheres = [];
  const binds = [];
  if (employeeId) { wheres.push("a.employee_id = ?"); binds.push(employeeId); }
  if (entityType) { wheres.push("a.entity_type = ?"); binds.push(entityType); }
  if (search.sql) { wheres.push(search.sql); binds.push(...search.binds); }
  const where = wheres.length ? " WHERE " + wheres.join(" AND ") : "";
  const from = `FROM record_archives a LEFT JOIN employees e ON e.employee_id = a.employee_id${where}`;
  const res = await env.DB.prepare(`
    SELECT a.archive_id, a.entity_type, a.entity_id, a.employee_id, a.action, a.reason,
           a.actor_name, a.archived_at, LENGTH(a.snapshot_json) AS snapshot_size,
           e.employee_name, e.employee_code
    ${from}
    ORDER BY a.archived_at DESC
    LIMIT ? OFFSET ?
  `).bind(...binds, limit, offset).all();
  // total = rows matching the CURRENT filter (drives "showing X of Y" + the load-more button);
  // counts = per-type totals for the chips, deliberately unfiltered.
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n ${from}`).bind(...binds).first();
  const counts = await env.DB.prepare("SELECT entity_type, COUNT(*) AS n FROM record_archives GROUP BY entity_type").all();
  return json({
    ok: true,
    total: (totalRow && totalRow.n) || 0,
    offset, limit,
    counts: (counts.results || []).map(r => ({ entityType: r.entity_type, count: r.n })),
    rows: (res.results || []).map(r => ({
      archiveId: r.archive_id, entityType: r.entity_type, entityId: r.entity_id, employeeId: r.employee_id,
      action: r.action, reason: r.reason, actorName: r.actor_name, archivedAt: r.archived_at,
      snapshotSize: r.snapshot_size,
      // Null once the employee is gone (purge) — the reason line carries their name for that case.
      employeeName: r.employee_name || null, employeeCode: r.employee_code || null
    }))
  });
}

// Owner-only audit log reader. Was served inside /adminData with a flat LIMIT 100 — which both hid
// history (146 rows existed, 100 showed) and made EVERY HR page load drag 100 log rows it never used.
async function auditList(request, env) {
  const { input, user } = await requireAdmin(request, env);
  if (!isOwner(env, user)) throw new Error("เฉพาะเจ้าของระบบเท่านั้นที่ดูประวัติการแก้ไขได้");
  await ensureAdminLogs(env);
  const { limit, offset } = pageArgs(input);
  const search = likeBinds(clean(input.q), ["action", "target", "detail", "user_name"]);
  const where = search.sql ? " WHERE " + search.sql : "";
  const res = await env.DB.prepare(
    `SELECT log_id, action, target, detail, user_name, created_at FROM admin_logs${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...search.binds, limit, offset).all();
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_logs${where}`).bind(...search.binds).first();
  return json({
    ok: true,
    total: (totalRow && totalRow.n) || 0,
    offset, limit,
    rows: (res.results || []).map(r => ({
      logId: r.log_id, action: r.action, target: r.target, detail: r.detail,
      userName: r.user_name, createdAt: r.created_at
    }))
  });
}

async function archiveGet(request, env) {
  const { input, user } = await requireAdmin(request, env);
  if (!isOwner(env, user)) throw new Error("เฉพาะเจ้าของระบบเท่านั้นที่ดูคลังค่าก่อนแก้ไขได้");
  await ensureRecordArchives(env);
  const row = await env.DB.prepare("SELECT * FROM record_archives WHERE archive_id = ? LIMIT 1").bind(clean(input.archiveId)).first();
  if (!row) throw new Error("ไม่พบรายการในคลัง");
  return json({
    ok: true,
    item: {
      archiveId: row.archive_id, entityType: row.entity_type, entityId: row.entity_id, employeeId: row.employee_id,
      action: row.action, reason: row.reason, actorName: row.actor_name, actorUserId: row.actor_user_id,
      archivedAt: row.archived_at, snapshot: safeJsonParse(row.snapshot_json)
    }
  });
}

// Extend probation by one more 30-day round (payroll-cycle aligned). Repeatable until HR
// approves (pass). Creates the next Probation eval task at monthNo = max+1, day = monthNo*30.
async function extendProbation(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureProbationCases(env);
  await ensureTaskLifecycle(env);
  const employeeId = clean(input.employeeId);
  if (!employeeId) throw new Error("employeeId is required.");
  const employee = await env.DB.prepare("SELECT * FROM employees WHERE employee_id = ? LIMIT 1").bind(employeeId).first();
  if (!employee) throw new Error("Employee not found.");
  // Probation only, in both queries. "Extend +30" means extending a probation; an IDP running to
  // Day 120 must not be picked up here, or MAX(month_no) reads 4 and opens a 150-day probation round.
  const kase = await env.DB.prepare(`
    SELECT * FROM probation_cases
    WHERE employee_id = ? AND COALESCE(program, 'probation') = 'probation'
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `).bind(employeeId).first();
  if (!kase || !kase.evaluator_user_id) throw new Error("ยังไม่ได้มอบหมายผู้ประเมิน ไม่สามารถขยายเวลาได้");
  const maxRow = await env.DB.prepare("SELECT MAX(COALESCE(month_no, 0)) AS m FROM tasks WHERE task_type = 'Probation' AND employee_id = ?").bind(employeeId).first();
  const nextMonth = Number((maxRow && maxRow.m) || 0) + 1;
  const day = nextMonth * 30;
  const start = clean(employee.start_date);
  const dueDate = start ? addDays(new Date(`${start}T00:00:00`), day - 1).toISOString().slice(0, 10) : null;
  const timestamp = nowIso();
  await createOrUpdateLifecycleTask(env, {
    taskType: "Probation",
    ownerUserId: kase.evaluator_user_id,
    employeeId,
    mentorUserId: kase.evaluator_user_id,
    title: `ประเมินทดลองงาน ${day} วัน (ขยายเวลา) - ${employee.employee_name}`,
    description: `แบบประเมินทดลองงานรอบ ${day} วัน (ขยายเวลา +30)`,
    dueDate,
    monthNo: nextMonth
  });
  await env.DB.prepare("UPDATE probation_cases SET status = 'active', result = 'extend', updated_at = ? WHERE case_id = ?").bind(timestamp, kase.case_id).run();
  await env.DB.prepare("UPDATE employees SET probation_status = 'active', updated_at = ? WHERE employee_id = ?").bind(timestamp, employeeId).run();
  await logAdminAction(env, user, "probation_extend", employeeId, `${employee.employee_name} · ขยายเป็นรอบ ${nextMonth} (${day} วัน)`);
  return json({ ok: true, nextMonth, day, dueDate });
}

async function saveProbationTemplate(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureProbationTemplates(env);
  const requestedId = clean(input.templateId);
  const isUpdate = Boolean(requestedId);
  // Fairness lock: a template already assigned to any probation case cannot be edited — clone instead.
  if (isUpdate && await templateInUse(env, requestedId)) {
    throw new Error("แบบฟอร์มนี้ถูกใช้งานแล้ว ไม่สามารถแก้ไขได้ — กรุณาบันทึกเป็นเวอร์ชันใหม่ (คัดลอก) เพื่อความเป็นธรรมในการประเมิน");
  }
  const templateId = requestedId || await nextId(env, "PT");
  const name = clean(input.name);
  if (!name) throw new Error("กรุณาตั้งชื่อแบบฟอร์ม");
  const sections = Array.isArray(input.sections) ? input.sections : [];
  if (!sections.length) throw new Error("ต้องมีอย่างน้อย 1 ส่วน");
  const scoredSum = sections
    .filter(s => ["kpi", "competency", "attendance"].includes(s.type))
    .reduce((a, s) => a + Number(s.weight || 0), 0);
  if (scoredSum !== 100) throw new Error(`น้ำหนักรวมต้องเท่ากับ 100 (ตอนนี้ ${scoredSum})`);
  const ratingBands = Array.isArray(input.ratingBands) && input.ratingBands.length ? input.ratingBands : PROBATION_RATING_BANDS;
  const timestamp = nowIso();
  await env.DB.prepare(`
    INSERT INTO probation_templates(template_id, name, level, sections_json, rating_bands_json, active, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(template_id) DO UPDATE SET
      name = excluded.name, level = excluded.level,
      sections_json = excluded.sections_json, rating_bands_json = excluded.rating_bands_json,
      active = 1, updated_at = excluded.updated_at
  `).bind(templateId, name, clean(input.level), JSON.stringify(sections), JSON.stringify(ratingBands), timestamp, timestamp).run();
  await logAdminAction(env, user, isUpdate ? "template_update" : "template_create", templateId, name);
  return json({ ok: true, templateId });
}

async function deleteProbationTemplate(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const templateId = clean(input.templateId);
  if (!templateId) throw new Error("templateId is required.");
  await ensureProbationTemplates(env);
  const active = input.active === true || input.active === 1 || input.active === "1" ? 1 : 0;
  await env.DB.prepare("UPDATE probation_templates SET active = ?, updated_at = ? WHERE template_id = ?").bind(active, nowIso(), templateId).run();
  await logAdminAction(env, user, active ? "template_restore" : "template_trash", templateId, "");
  return json({ ok: true });
}

async function resolveActor(env, input) {
  if (input.webSessionToken) {
    const webUser = await getUserFromWebSession(env, input.webSessionToken);
    if (webUser && webUser.active) return webUser;
  }
  const verified = await resolveLineIdentity(env, input);
  const user = await getUserByLine(env, verified.sub);
  // Deactivated accounts must not be able to act (open/submit tasks, etc.)
  return user && user.active ? user : null;
}

async function saveTaskDraft(request, env) {
  const input = await readJson(request);
  const user = await resolveActor(env, input);
  if (!user) throw new Error("Please register before saving drafts.");
  const taskId = clean(input.taskId);
  const task = await env.DB.prepare("SELECT * FROM tasks WHERE task_id = ? LIMIT 1").bind(taskId).first();
  if (!task) throw new Error("Task not found.");
  if (task.owner_user_id !== user.user_id && user.role !== "HR") throw new Error("This task does not belong to you.");
  if (task.status === "Completed") throw new Error("This task is already completed.");
  await env.DB.prepare("UPDATE tasks SET submission_json = ?, updated_at = ? WHERE task_id = ?")
    .bind(JSON.stringify(input.submission || {}), nowIso(), taskId).run();
  return json({ ok: true });
}

async function submitTask(request, env) {
  const input = await readJson(request);
  const user = await resolveActor(env, input);
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

// Toggle self-review on a template. Kept separate from saveProbationTemplate because it is
// display-only (does not affect the scoring form) so it must work even on a locked/in-use template.
async function setTemplateSelfReview(request, env) {
  const { input, user } = await requireAdmin(request, env);
  await ensureProbationTemplates(env);
  const templateId = clean(input.templateId);
  if (!templateId) throw new Error("templateId is required.");
  const enabled = input.enabled === true || input.enabled === 1 || input.enabled === "1" ? 1 : 0;
  await env.DB.prepare("UPDATE probation_templates SET self_review_enabled = ?, updated_at = ? WHERE template_id = ?").bind(enabled, nowIso(), templateId).run();
  await logAdminAction(env, user, "template_self_review", templateId, enabled ? "on" : "off");
  return json({ ok: true });
}

// Resolve the caller's own Completed probation round + its template. Shared by the two
// employee-facing self-review endpoints so their auth/lookup stays identical.
async function loadOwnProbationRound(env, input) {
  const user = await resolveActor(env, input);
  if (!user || !user.employee_id) throw new Error("กรุณาเข้าสู่ระบบในฐานะพนักงาน");
  const taskId = clean(input.taskId);
  const task = await env.DB.prepare("SELECT task_id, task_type, employee_id, month_no, status, submission_json FROM tasks WHERE task_id = ? LIMIT 1").bind(taskId).first();
  if (!task || task.task_type !== "Probation") throw new Error("ไม่พบรอบประเมิน");
  if (task.employee_id !== user.employee_id) throw new Error("รอบประเมินนี้ไม่ใช่ของคุณ");
  if (task.status !== "Completed") throw new Error("หัวหน้างานยังประเมินรอบนี้ไม่เสร็จ — เปิดประเมินตนเองได้เมื่อหัวหน้าประเมินเสร็จแล้ว");
  // Probation-scoped: this endpoint is gated to Probation tasks above, so it must read the
  // probation case — not an IDP case that happens to belong to the same person.
  const kase = await env.DB.prepare(`
    SELECT template_id FROM probation_cases
    WHERE employee_id = ? AND COALESCE(program, 'probation') = 'probation'
    ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1
  `).bind(user.employee_id).first();
  const templateId = (kase && kase.template_id) || "PT-C";
  const tpl = await env.DB.prepare("SELECT sections_json, self_review_enabled FROM probation_templates WHERE template_id = ? LIMIT 1").bind(templateId).first();
  if (!tpl || !tpl.self_review_enabled) throw new Error("แบบฟอร์มนี้ไม่ได้เปิดให้ประเมินตนเอง");
  await ensureProbationSelfReviews(env);
  return { user, task, sections: JSON.parse(tpl.sections_json || "[]") };
}

// Employee self-review form data: competency items to self-rate + read-only attendance FACTS the
// boss recorded (so the employee isn't confused about their own late/leave counts). No boss scores.
async function getProbationSelfForm(request, env) {
  const input = await readJson(request);
  const { task, sections } = await loadOwnProbationRound(env, input);
  const bossState = (safeJsonParse(task.submission_json) || {}).state || {};
  const scored = [];
  const attendance = [];
  sections.forEach((sec, idx) => {
    if (sec.type === "competency") {
      scored.push({ idx, type: "competency", title: sec.title, scale: sec.scale || {}, items: (sec.items || []).map(it => ({ label: it.label })) });
    } else if (sec.type === "kpi") {
      // KPI items are the rows the boss entered for THIS round (labels only, no boss scores).
      const rows = (bossState[idx] && bossState[idx].rows) || [];
      if (rows.length) scored.push({ idx, type: "kpi", title: sec.title, scale: sec.scale || {}, items: rows.map(r => ({ label: r.label || "" })) });
    } else if (sec.type === "attendance") {
      const counts = (bossState[idx] && bossState[idx].counts) || {};
      attendance.push({ title: sec.title, rows: (sec.fields || []).map(f => ({ label: f.label, count: Number(counts[f.key] || 0) })) });
    }
  });
  const existing = await env.DB.prepare("SELECT self_json FROM probation_self_reviews WHERE task_id = ? LIMIT 1").bind(task.task_id).first();
  const answers = existing ? ((safeJsonParse(existing.self_json) || {}).scores || {}) : {};
  return json({ ok: true, day: Number(task.month_no || 0) * 30, scored, attendance, answers, submitted: Boolean(existing) });
}

async function submitProbationSelfReview(request, env) {
  const input = await readJson(request);
  const { task } = await loadOwnProbationRound(env, input);
  const existing = await env.DB.prepare("SELECT task_id FROM probation_self_reviews WHERE task_id = ? LIMIT 1").bind(task.task_id).first();
  if (existing) throw new Error("คุณได้ประเมินตนเองรอบนี้ไปแล้ว");
  const scores = (input.submission && input.submission.scores) || {};
  await env.DB.prepare("INSERT INTO probation_self_reviews(task_id, employee_id, self_json, submitted_at) VALUES(?, ?, ?, ?)")
    .bind(task.task_id, task.employee_id, JSON.stringify({ scores }), nowIso()).run();
  return json({ ok: true });
}

// HR-only gap view: competency self vs boss per round (only rounds the employee self-reviewed).
async function getProbationGap(request, env) {
  const { input } = await requireAdmin(request, env);
  const employeeId = clean(input.employeeId);
  if (!employeeId) throw new Error("employeeId is required.");
  await ensureProbationSelfReviews(env);
  const [tasks, selfRows] = await Promise.all([
    env.DB.prepare("SELECT task_id, month_no, submission_json FROM tasks WHERE employee_id = ? AND task_type = 'Probation' AND status = 'Completed' ORDER BY COALESCE(month_no, 0)").bind(employeeId).all(),
    env.DB.prepare("SELECT task_id, self_json FROM probation_self_reviews WHERE employee_id = ?").bind(employeeId).all()
  ]);
  const selfMap = new Map((selfRows.results || []).map(r => [r.task_id, (safeJsonParse(r.self_json) || {}).scores || {}]));
  const rounds = [];
  for (const t of (tasks.results || [])) {
    const mine = selfMap.get(t.task_id);
    if (!mine) continue;
    const sub = safeJsonParse(t.submission_json) || {};
    const sections = (sub.template && sub.template.sections) || [];
    const bossState = sub.state || {};
    const items = [];
    const pushItem = (label, bossVal, selfVal, max) => {
      const b = Number(bossVal) > 0 ? Number(bossVal) : null;
      const s = Number(selfVal) > 0 ? Number(selfVal) : null;
      items.push({ label, max: max || null, boss: b, self: s, delta: (b != null && s != null) ? s - b : null });
    };
    sections.forEach((sec, idx) => {
      const self = mine[idx] || [];
      const max = (sec.scale && sec.scale.max) || null;
      if (sec.type === "competency") {
        const boss = (bossState[idx] && bossState[idx].scores) || [];
        (sec.items || []).forEach((it, i) => pushItem(it.label, boss[i], self[i], max));
      } else if (sec.type === "kpi") {
        const rows = (bossState[idx] && bossState[idx].rows) || [];
        rows.forEach((r, i) => pushItem(r.label || "", r.score, self[i], max));
      }
    });
    if (items.length) rounds.push({ day: Number(t.month_no || 0) * 30, items });
  }
  return json({ ok: true, rounds });
}

async function sendLineMessage(request, env) {
  const { input, user } = await requireAdmin(request, env);
  const target = await getUserById(env, clean(input.userId));
  if (!target || !target.line_user_id) throw new Error("Target user has no LINE UserID.");

  const message = clean(input.message || "Nose Tea Onboarding reminder");
  const taskId = clean(input.taskId);
  const task = await getEnrichedTaskForOwner(env, target.user_id, taskId);
  if (task) {
    await sendTaskCard(env, target, task, user.user_id);
  } else {
    await pushFlexToLine(env, target, reminderFlexMessage(message, "Open LIFF", taskId), message, user.user_id, "");
  }
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
    try {
      if (task) await sendTaskCard(env, target, task, user.user_id);
      else await pushFlexToLine(env, target, reminderFlexMessage(message, "Open LIFF"), message, user.user_id, "");
      sent += 1;
    } catch (error) {
      failed += 1;
    }
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
  // SECURITY: demo seeding is disabled unless a secret env SEED_KEY is set and matches.
  if (!env.SEED_KEY || url.searchParams.get("key") !== env.SEED_KEY) throw new Error("Seeding is disabled.");
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

function corsOrigin(request, env) {
  const list = clean(env.ALLOWED_ORIGINS).split(",").map(s => s.trim()).filter(Boolean);
  if (!list.length) return "*"; // not configured → stay open (no breakage)
  const origin = request.headers.get("Origin") || "";
  if (list.includes(origin)) return origin;
  // Allow Cloudflare preview deploys of the SAME project (<hash>.<project>.pages.dev),
  // but not arbitrary third-party *.pages.dev sites.
  try {
    const host = new URL(origin).hostname;
    const ok = list.some(o => {
      let h;
      try { h = new URL(o).hostname; } catch (e) { return false; }
      return /\.pages\.dev$/.test(h) && (host === h || host.endsWith(`.${h}`));
    });
    if (ok) return origin;
  } catch (e) {}
  return list[0];
}

function corsHeaders(request, env) {
  return { ...CORS_HEADERS, "Access-Control-Allow-Origin": corsOrigin(request, env), "Vary": "Origin" };
}

function sanitizeError(error) {
  const msg = String((error && error.message) || error || "");
  if (/no such (column|table)|SQL|D1_|syntax error|near "|undefined is not|cannot read|TypeError|is not a function/i.test(msg)) {
    return "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง";
  }
  return msg || "เกิดข้อผิดพลาด";
}

async function ensureRateLimits(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS rate_limits (rl_key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start TEXT NOT NULL)").run();
}

async function rateLimit(env, request, action, max, windowSec) {
  try {
    await ensureRateLimits(env);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = `${action}:${ip}`;
    const now = Date.now();
    const row = await env.DB.prepare("SELECT count, window_start FROM rate_limits WHERE rl_key = ?").bind(key).first();
    if (!row || (now - Number(row.window_start)) > windowSec * 1000) {
      await env.DB.prepare("INSERT INTO rate_limits(rl_key, count, window_start) VALUES(?, 1, ?) ON CONFLICT(rl_key) DO UPDATE SET count = 1, window_start = excluded.window_start").bind(key, String(now)).run();
      return;
    }
    if (row.count >= max) throw new Error("พยายามบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
    await env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE rl_key = ?").bind(key).run();
  } catch (error) {
    if (String((error && error.message) || "").includes("พยายามบ่อยเกิน")) throw error;
    // rate-limit storage failure must never block a legitimate request
  }
}

// Returns the welcome Flex card JSON (single source of truth in flex.js). The Messaging API
// webhook is owned by a separate bot worker; on a `follow` event it fetches this card and
// replies with it — so the card design lives in one place and stays on-brand.
async function welcomeCard(request, env) {
  return json({ ok: true, message: welcomeFlexMessage() });
}

// Email is optional contact info, but the live users.email column is UNIQUE NOT NULL (D1 can't
// migrate it — FK deferral isn't supported except via CLI, which is blocked). So when an email is
// blank or already taken by another user, store a hidden unique placeholder; publicUser() hides it.
async function emailForStorage(env, email, userId) {
  const cleaned = String(email || "").trim().toLowerCase();
  if (!cleaned) return placeholderEmail(userId);
  const taken = await env.DB.prepare("SELECT user_id FROM users WHERE lower(email) = lower(?) AND user_id <> ? LIMIT 1").bind(cleaned, userId).first();
  return taken ? placeholderEmail(userId) : cleaned;
}

// Generic key/value settings. Currently holds HR-editable OB Feedback score captions.
async function ensureAppSettings(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)").run();
}

async function getFeedbackScale(env) {
  await ensureAppSettings(env);
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'ob_feedback_labels'").first();
  const parsed = row ? safeJsonParse(row.value) : null;
  return Array.isArray(parsed) ? parsed.map(x => String(x || "")) : null;
}

async function saveFeedbackScale(request, env) {
  const { input } = await requireAdmin(request, env);
  await ensureAppSettings(env);
  const labels = Array.isArray(input.labels) ? input.labels.slice(0, 10).map(x => String(x || "")) : [];
  await env.DB.prepare("INSERT INTO app_settings(key, value, updated_at) VALUES('ob_feedback_labels', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(JSON.stringify(labels), nowIso()).run();
  return json({ ok: true });
}

async function handleRoute(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "/");
  if (path === "/health" || path === "/") return json({ ok: true });
  // KPI + 360 modules — shared helpers passed via ctx (no code moved out of worker.js = zero risk to old routes).
  if (path.startsWith("/kpi/") || path.startsWith("/360/")) {
    // archive* added to the bridge deliberately (HANDOFF 0.1 rule): the append-only audit archive
    // must be written by whoever overwrites a value, and KPI/360 own their own overwrite paths.
    const ctx = { json, clean, nowIso, addDays, nextId, isOwner, requireAdmin, requireViewer, resolveActor, logAdminAction, getUserById, readJson, ensureRecordArchives, archiveStmt, archiveSnapshot, seedOnce };
    return path.startsWith("/kpi/") ? handleKpi(path, request, env, ctx) : handle360(path, request, env, ctx);
  }
  if (path === "/welcomeCard") return welcomeCard(request, env);
  if (path === "/saveFeedbackScale") return saveFeedbackScale(request, env);
  if (path === "/registerUser") return registerUser(request, env);
      if (path === "/webLoginExchange") return webLoginExchange(request, env);
      if (path === "/getPortal") return getPortal(request, env);
      if (path === "/getTask") return getTask(request, env);
      if (path === "/adminData") return adminData(request, env);
      if (path === "/execSummary") return execSummary(request, env);
      if (path === "/upsertMessageTemplate") return upsertMessageTemplate(request, env);
      if (path === "/deleteMessageTemplate") return deleteMessageTemplate(request, env);
      if (path === "/createOnboardingGroup") return createOnboardingGroup(request, env);
      if (path === "/deleteOnboardingGroup") return deleteOnboardingGroup(request, env);
      if (path === "/updateGroupMembers") return updateGroupMembers(request, env);
      if (path === "/adminUpdateUser") return adminUpdateUser(request, env);
      if (path === "/adminUpsertEmployee") return adminUpsertEmployee(request, env);
      if (path === "/adminImportEmployees") return adminImportEmployees(request, env);
      if (path === "/adminUnlinkEmployee") return adminUnlinkEmployee(request, env);
      if (path === "/adminLinkEmployee") return adminLinkEmployee(request, env);
      if (path === "/adminDeleteUser") return adminDeleteUser(request, env);
      if (path === "/adminDeleteEmployee") return adminDeleteEmployee(request, env);
      if (path === "/createCheckpoint") return createCheckpoint(request, env);
      if (path === "/updateCheckpoint") return updateCheckpoint(request, env);
      if (path === "/syncGroupLifecycle") return syncGroupLifecycle(request, env);
      if (path === "/runDailyAutomation") return runDailyAutomation(request, env);
      if (path === "/runSessionAnnouncements") return runSessionAnnouncements(request, env);
      if (path === "/announceSessionNow") return announceSessionNow(request, env);
      if (path === "/forceTasks") return forceTasks(request, env);
      if (path === "/assignProbationSupervisor") return assignProbationSupervisor(request, env);
      if (path === "/updateProbationCase") return updateProbationCase(request, env);
      if (path === "/overrideProbationPass") return overrideProbationPass(request, env);
      if (path === "/extendProbation") return extendProbation(request, env);
      if (path === "/exportBackup") return exportBackup(request, env);
      if (path === "/archiveList") return archiveList(request, env);
      if (path === "/archiveGet") return archiveGet(request, env);
      if (path === "/auditList") return auditList(request, env);
      if (path === "/saveProbationTemplate") return saveProbationTemplate(request, env);
      if (path === "/setTemplateSelfReview") return setTemplateSelfReview(request, env);
      if (path === "/deleteProbationTemplate") return deleteProbationTemplate(request, env);
      if (path === "/getProbationSelfForm") return getProbationSelfForm(request, env);
      if (path === "/submitProbationSelfReview") return submitProbationSelfReview(request, env);
      if (path === "/getProbationGap") return getProbationGap(request, env);
      if (path === "/saveTaskDraft") return saveTaskDraft(request, env);
      if (path === "/submitTask") return submitTask(request, env);
      if (path === "/sendLineMessage") return sendLineMessage(request, env);
      if (path === "/sendSegmentLine") return sendSegmentLine(request, env);
      if (path === "/sendPreviewFlex") return sendPreviewFlex(request, env);
  if (path === "/seedDemoData") return seedDemoData(request, env);
  return json({ ok: false, error: "Not found." }, 404);
}

// Employee-facing probation reminder — fires ONLY on a round's due date (once), so it's cheap on
// LINE quota. Supervisors get advance reminders separately; the employee gets one heads-up per round.
async function dispatchProbationMenteeReminders(env) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return { sent: 0 };
  const today = nowIso().slice(0, 10);
  const rows = await env.DB.prepare(
    "SELECT t.month_no, u.line_user_id FROM tasks t " +
    "JOIN employees e ON e.employee_id = t.employee_id " +
    "JOIN users u ON u.user_id = e.user_id " +
    "WHERE t.task_type = 'Probation' AND t.status NOT IN ('Completed') AND t.due_date = ? " +
    "AND u.line_user_id IS NOT NULL AND u.active = 1"
  ).bind(today).all();
  let sent = 0;
  for (const r of (rows.results || [])) {
    const day = (r.month_no || 0) * 30;
    const msg = `ถึงรอบประเมินทดลองงาน ${day} วันแล้ว — หัวหน้างานจะประเมินคุณเร็ว ๆ นี้ เปิดแอปเพื่อดูสถานะได้`;
    try { await pushFlexToLine(env, { line_user_id: r.line_user_id }, reminderFlexMessage(msg, "เปิด HR Portal"), msg, "SYSTEM", ""); sent += 1; } catch (e) { /* skip individual failures */ }
  }
  return { sent };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
    let response;
    try {
      response = await handleRoute(request, env);
    } catch (error) {
      console.log("API error:", (error && error.stack) || error);
      response = json({ ok: false, error: sanitizeError(error) }, 400);
    }
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", cors["Access-Control-Allow-Origin"]);
    headers.set("Vary", "Origin");
    return new Response(response.body, { status: response.status, headers });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await dispatchDueNotifications(env);
      await dispatchSessionAnnouncements(env);
      await dispatchProbationMenteeReminders(env);
    })());
  }
};
