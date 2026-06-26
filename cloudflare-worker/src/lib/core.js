export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

export function nowIso() {
  return new Date().toISOString();
}

export function clean(value) {
  return String(value || "").trim();
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeRole(role) {
  const text = clean(role).toLowerCase();
  if (text.includes("hr") || text.includes("admin")) return "HR";
  if (text.includes("exec") || text.includes("director") || text.includes("ผู้บริหาร")) return "Executive";
  if (text.includes("mentor")) return "Mentor";
  return "Mentee";
}

export function liffUrl(taskId = "") {
  const base = "https://liff.line.me/2010372532-0i3JE94q";
  return taskId ? `${base}?taskId=${encodeURIComponent(taskId)}` : base;
}

export function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function toPublicTask(row) {
  return {
    taskId: row.task_id,
    taskType: row.task_type,
    checkpointId: row.checkpoint_id,
    ownerUserId: row.owner_user_id,
    employeeId: row.employee_id,
    mentorUserId: row.mentor_user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    monthNo: row.month_no || null,
    groupId: row.group_id || null,
    submittedAt: row.submitted_at,
    submission: safeJsonParse(row.submission_json),
    target: row.target_name || row.employee_name || row.mentor_name || "Self",
    sessionDate: row.session_date,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room
  };
}

export function progressFromTasks(tasks) {
  const total = tasks.length;
  const completed = tasks.filter(task => task.status === "Completed").length;
  return {
    total,
    completed,
    pending: total - completed,
    percent: total ? Math.round((completed / total) * 100) : 100
  };
}

export function publicUser(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    employeeId: row.employee_id,
    lineUserId: row.line_user_id,
    displayName: row.display_name,
    name: row.name,
    role: row.role,
    department: row.department,
    position: row.position,
    email: row.email,
    active: Boolean(row.active)
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
