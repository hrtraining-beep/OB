// ============================================================================
// KPI System — backend handlers (see PROJECT_KPI.md + HANDOFF_M3.md §0.1)
// ----------------------------------------------------------------------------
// RULES (cross-session discipline): additive only; shared helpers via `ctx`; never touch worker.js
// internals; new tables use CREATE TABLE IF NOT EXISTS; routes namespaced under /kpi/*.
// Grade thresholds are NOT stored on Corporate KPI — the department head sets them when distributing
// (PROJECT_KPI.md §3). So corporate is objective/weight/target only here.
// ============================================================================

// Optional grouping category (Balanced Scorecard). Thai-first with English in parentheses per the
// company's Excel. Optional — KPIs can be left uncategorised (assignment is subjective by design).
const PERSPECTIVES = ["การเงิน (Finance)", "ลูกค้า (Customer)", "กระบวนการภายใน (Internal Process)", "การเรียนรู้และพัฒนา (Learning & Growth)"];

async function ensureKpiTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_cycles (
    cycle_id TEXT PRIMARY KEY,
    cycle_year INTEGER NOT NULL,
    cycle_period TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    start_date TEXT,
    due_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  for (const ddl of ["ALTER TABLE kpi_cycles ADD COLUMN start_date TEXT", "ALTER TABLE kpi_cycles ADD COLUMN due_date TEXT"]) {
    try { await env.DB.prepare(ddl).run(); } catch (e) { if (!String(e.message || e).includes("duplicate column name")) throw e; }
  }
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_corporate (
    kpi_id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    perspective TEXT,
    objective_code TEXT,
    kpi_code TEXT,
    title TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 0,
    target TEXT,
    unit TEXT,
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_department_assignments (
    assignment_id TEXT PRIMARY KEY,
    kpi_id TEXT NOT NULL,
    department TEXT NOT NULL,
    weight_allocated REAL,
    assigned_by TEXT,
    assigned_at TEXT
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kpi_dept_assign_kpi ON kpi_department_assignments(kpi_id)").run();
  // --- ก้อน 3c: หัวหน้าฝ่าย แจก KPI ให้พนักงาน + ตั้งเกณฑ์ grade 1-5 ---
  // HR แต่งตั้งหัวหน้าฝ่าย (1 คน/ฝ่าย) — role เดิมไม่มี "head" จึงเก็บ mapping department→user ที่นี่.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_department_heads (
    department TEXT PRIMARY KEY,
    user_id TEXT,
    assigned_by TEXT,
    assigned_at TEXT
  )`).run();
  // เกณฑ์ grade 1-5 = คำอธิบายข้อความต่อ grade (ยืดหยุ่นกว่า threshold ตัวเลขล้วน เพราะ KPI หลายข้อ subjective).
  // ตั้งต่อ (kpi_id, department) — ทุกคนในฝ่ายที่ถือ KPI นั้นใช้เกณฑ์เดียวกัน.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_grade_criteria (
    kpi_id TEXT NOT NULL,
    department TEXT NOT NULL,
    g1 TEXT, g2 TEXT, g3 TEXT, g4 TEXT, g5 TEXT,
    updated_by TEXT,
    updated_at TEXT,
    PRIMARY KEY (kpi_id, department)
  )`).run();
  // แจก KPI ให้พนักงานรายคน (assignment ผูกกับ user ที่ล็อกอินได้ เพื่อรองรับ self-fill ในก้อน 4).
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_individual_assignments (
    ind_assignment_id TEXT PRIMARY KEY,
    kpi_id TEXT NOT NULL,
    department TEXT NOT NULL,
    user_id TEXT NOT NULL,
    assigned_by TEXT,
    assigned_at TEXT
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kpi_ind_assign_kpi ON kpi_individual_assignments(kpi_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kpi_ind_assign_user ON kpi_individual_assignments(user_id)").run();
  // --- ก้อน 4: หัวหน้าแตก KPI องค์กรเป็น "KPI ย่อย" ต่อคน (เป้า+เกณฑ์ grade ของตัวเอง) ---
  // parent_kpi_id = KPI องค์กรที่ย่อยนี้อยู่ภายใต้ (NULL = KPI เฉพาะบุคคล ไม่ผูก corporate).
  // เกณฑ์ grade (g1-g5) + เป้า ย้ายมาอยู่ที่ระดับ sub-KPI ต่อคน (ตามดีไซน์ที่ล็อกกับ user).
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_sub (
    sub_id TEXT PRIMARY KEY,
    parent_kpi_id TEXT,
    cycle_id TEXT,
    department TEXT NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL,
    target TEXT,
    unit TEXT,
    weight REAL,
    g1 TEXT, g2 TEXT, g3 TEXT, g4 TEXT, g5 TEXT,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kpi_sub_dept ON kpi_sub(department)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kpi_sub_parent ON kpi_sub(parent_kpi_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_kpi_sub_user ON kpi_sub(user_id)").run();
  // ก้อน 4 chunk 2: ผลการทำ KPI ย่อย — พนักงานกรอก actual + self_grade → หัวหน้า approve final_grade.
  for (const ddl of [
    "ALTER TABLE kpi_sub ADD COLUMN actual_result TEXT",
    "ALTER TABLE kpi_sub ADD COLUMN self_grade INTEGER",
    "ALTER TABLE kpi_sub ADD COLUMN self_submitted_at TEXT",
    "ALTER TABLE kpi_sub ADD COLUMN final_grade INTEGER",
    "ALTER TABLE kpi_sub ADD COLUMN approved_by TEXT",
    "ALTER TABLE kpi_sub ADD COLUMN approved_at TEXT"
  ]) {
    try { await env.DB.prepare(ddl).run(); } catch (e) { if (!String(e.message || e).includes("duplicate column name")) throw e; }
  }
  // chunk 3b: ความคืบหน้ารายเดือน (snapshot) — 1 แถว/(sub, month) · เห็นเส้นทางเดือน 1→N ตาม north star.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_progress (
    progress_id TEXT PRIMARY KEY,
    sub_id TEXT NOT NULL,
    month_no INTEGER NOT NULL,
    value TEXT,
    note TEXT,
    updated_at TEXT
  )`).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_prog_sub_month ON kpi_progress(sub_id, month_no)").run();
}

// Nullable grade 1-5; throws on a bad value.
function gradeOrNull(v, ctx) {
  const s = ctx.clean(v);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error("เกรดต้องเป็นเลข 1-5");
  return n;
}

export async function handleKpi(path, request, env, ctx) {
  await ensureKpiTables(env);
  if (path === "/kpi/overview") return kpiOverview(request, env, ctx);
  if (path === "/kpi/cycle/save") return kpiCycleSave(request, env, ctx);
  if (path === "/kpi/cycle/delete") return kpiCycleDelete(request, env, ctx);
  if (path === "/kpi/corporate/save") return kpiCorporateSave(request, env, ctx);
  if (path === "/kpi/corporate/delete") return kpiCorporateDelete(request, env, ctx);
  if (path === "/kpi/corporate/assign") return kpiCorporateAssign(request, env, ctx);
  if (path === "/kpi/publish") return kpiPublish(request, env, ctx);
  if (path === "/kpi/unpublish") return kpiUnpublish(request, env, ctx);
  if (path === "/kpi/heads/save") return kpiHeadsSave(request, env, ctx);        // HR แต่งตั้งหัวหน้าฝ่าย
  if (path === "/kpi/dept/overview") return kpiDeptOverview(request, env, ctx);   // หัวหน้าฝ่าย: KPI ที่ฝ่ายได้รับ
  if (path === "/kpi/dept/criteria") return kpiDeptCriteriaSave(request, env, ctx); // ตั้งเกณฑ์ grade 1-5
  if (path === "/kpi/dept/assign") return kpiDeptAssign(request, env, ctx);       // แจก KPI ให้พนักงาน
  if (path === "/kpi/sub/save") return kpiSubSave(request, env, ctx);             // ก้อน 4: แตก KPI ย่อย
  if (path === "/kpi/sub/delete") return kpiSubDelete(request, env, ctx);
  if (path === "/kpi/my") return kpiMyList(request, env, ctx);                    // ก้อน 4 chunk 2: พนักงานดู KPI ตัวเอง
  if (path === "/kpi/my/submit") return kpiMySubmit(request, env, ctx);           // พนักงานกรอกผล + self-grade
  if (path === "/kpi/my/progress") return kpiProgressSave(request, env, ctx);     // chunk 3b: อัปเดตผลรายเดือน
  if (path === "/kpi/sub/approve") return kpiSubApprove(request, env, ctx);       // หัวหน้า approve final grade
  if (path === "/kpi/dashboard") return kpiDashboard(request, env, ctx);          // ก้อน 4 chunk 3a: คะแนนรวมองค์กร (HR/Exec)
  return ctx.json({ ok: false, error: "Unknown KPI route." }, 404);
}

// Cycles + the Corporate KPIs of one cycle (default = latest). Weight sum computed on the client.
async function kpiOverview(request, env, ctx) {
  const { input } = await ctx.requireAdmin(request, env);
  const cyclesRes = await env.DB.prepare("SELECT * FROM kpi_cycles ORDER BY cycle_year DESC, cycle_period ASC").all();
  const cycles = (cyclesRes.results || []).map(c => ({ cycleId: c.cycle_id, year: c.cycle_year, period: c.cycle_period, status: c.status, startDate: c.start_date, dueDate: c.due_date }));
  let cycleId = ctx.clean(input.cycleId);
  if ((!cycleId || !cycles.some(c => c.cycleId === cycleId)) && cycles.length) cycleId = cycles[0].cycleId;
  // Departments available to assign KPIs to = the distinct departments in the employee master.
  const deptRes = await env.DB.prepare("SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND TRIM(department) != '' ORDER BY department").all();
  const departments = (deptRes.results || []).map(r => r.department);
  // Department heads (HR-appointed) + candidate users per department for the head-picker.
  const headRes = await env.DB.prepare("SELECT h.department, h.user_id, u.name FROM kpi_department_heads h LEFT JOIN users u ON u.user_id = h.user_id").all();
  const heads = (headRes.results || []).map(h => ({ department: h.department, userId: h.user_id, userName: h.name || null }));
  const candRes = await env.DB.prepare("SELECT user_id, name, department FROM users WHERE active = 1 AND department IS NOT NULL AND TRIM(department) != '' ORDER BY name").all();
  const deptUsers = {};
  (candRes.results || []).forEach(u => { (deptUsers[u.department] = deptUsers[u.department] || []).push({ userId: u.user_id, name: u.name || u.user_id }); });

  let kpis = [];
  if (cycleId) {
    const kres = await env.DB.prepare("SELECT * FROM kpi_corporate WHERE cycle_id = ? ORDER BY perspective, objective_code, kpi_code, created_at").bind(cycleId).all();
    const asgRes = await env.DB.prepare("SELECT a.kpi_id, a.department, a.weight_allocated FROM kpi_department_assignments a JOIN kpi_corporate k ON k.kpi_id = a.kpi_id WHERE k.cycle_id = ?").bind(cycleId).all();
    const byKpi = new Map();
    (asgRes.results || []).forEach(a => {
      if (!byKpi.has(a.kpi_id)) byKpi.set(a.kpi_id, []);
      byKpi.get(a.kpi_id).push({ department: a.department, weightAllocated: a.weight_allocated });
    });
    kpis = (kres.results || []).map(k => ({
      kpiId: k.kpi_id, perspective: k.perspective, objectiveCode: k.objective_code, kpiCode: k.kpi_code,
      title: k.title, weight: k.weight, target: k.target, unit: k.unit, deadline: k.deadline, status: k.status,
      departments: byKpi.get(k.kpi_id) || []
    }));
  }
  return ctx.json({ ok: true, cycles, cycleId: cycleId || null, kpis, departments, perspectives: PERSPECTIVES, heads, deptUsers });
}

async function kpiCycleSave(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const year = Number(ctx.clean(input.year));
  const period = ctx.clean(input.period);
  // Thai app → year is พ.ศ. (Buddhist era, e.g. 2569). Accept a generous พ.ศ. range.
  if (!Number.isInteger(year) || year < 2500 || year > 2700) throw new Error("ปีไม่ถูกต้อง (ใส่เป็น พ.ศ. เช่น 2569)");
  if (!["H1", "H2", "Full"].includes(period)) throw new Error("รอบไม่ถูกต้อง (H1/H2/Full)");
  const startDate = ctx.clean(input.startDate) || null;
  const dueDate = ctx.clean(input.dueDate) || null;
  const ts = ctx.nowIso();
  // Timeframe lives on the CYCLE (all its KPIs share it). Re-saving the same year+period updates dates.
  const dup = await env.DB.prepare("SELECT cycle_id FROM kpi_cycles WHERE cycle_year = ? AND cycle_period = ? LIMIT 1").bind(year, period).first();
  if (dup) {
    await env.DB.prepare("UPDATE kpi_cycles SET start_date = ?, due_date = ?, updated_at = ? WHERE cycle_id = ?").bind(startDate, dueDate, ts, dup.cycle_id).run();
    return ctx.json({ ok: true, cycleId: dup.cycle_id, existed: true });
  }
  const cycleId = await ctx.nextId(env, "KC");
  await env.DB.prepare("INSERT INTO kpi_cycles(cycle_id, cycle_year, cycle_period, status, start_date, due_date, created_at, updated_at) VALUES(?, ?, ?, 'draft', ?, ?, ?, ?)").bind(cycleId, year, period, startDate, dueDate, ts, ts).run();
  await ctx.logAdminAction(env, user, "kpi_cycle_create", cycleId, `${year} ${period}`);
  return ctx.json({ ok: true, cycleId });
}

async function kpiCycleDelete(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  await env.DB.prepare("DELETE FROM kpi_corporate WHERE cycle_id = ?").bind(cycleId).run();
  await env.DB.prepare("DELETE FROM kpi_cycles WHERE cycle_id = ?").bind(cycleId).run();
  await ctx.logAdminAction(env, user, "kpi_cycle_delete", cycleId, "");
  return ctx.json({ ok: true });
}

async function kpiCorporateSave(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("ต้องเลือกรอบ (cycle) ก่อน");
  const title = ctx.clean(input.title);
  if (!title) throw new Error("กรุณาใส่ชื่อ KPI");
  const perspective = ctx.clean(input.perspective);
  if (perspective && !PERSPECTIVES.includes(perspective)) throw new Error("Perspective ไม่ถูกต้อง");
  const weight = Number(ctx.clean(input.weight)) || 0;
  if (weight < 0 || weight > 100) throw new Error("น้ำหนักต้องอยู่ในช่วง 0-100");
  const ts = ctx.nowIso();
  const kpiId = ctx.clean(input.kpiId);
  const bindTail = [perspective, ctx.clean(input.objectiveCode), ctx.clean(input.kpiCode), title, weight, ctx.clean(input.target), ctx.clean(input.unit), ctx.clean(input.deadline) || null];
  if (kpiId) {
    await env.DB.prepare("UPDATE kpi_corporate SET perspective=?, objective_code=?, kpi_code=?, title=?, weight=?, target=?, unit=?, deadline=?, updated_at=? WHERE kpi_id=?")
      .bind(...bindTail, ts, kpiId).run();
    // keep per-department allocation in sync if the weight changed
    const asg = await env.DB.prepare("SELECT COUNT(*) AS n FROM kpi_department_assignments WHERE kpi_id = ?").bind(kpiId).first();
    if (asg && asg.n > 0) {
      await env.DB.prepare("UPDATE kpi_department_assignments SET weight_allocated = ? WHERE kpi_id = ?").bind(Math.round((weight / asg.n) * 100) / 100, kpiId).run();
    }
    await ctx.logAdminAction(env, user, "kpi_corporate_update", kpiId, title);
    return ctx.json({ ok: true, kpiId });
  }
  const newId = await ctx.nextId(env, "KPI");
  await env.DB.prepare("INSERT INTO kpi_corporate(kpi_id, cycle_id, perspective, objective_code, kpi_code, title, weight, target, unit, deadline, status, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
    .bind(newId, cycleId, ...bindTail, ts, ts).run();
  await ctx.logAdminAction(env, user, "kpi_corporate_create", newId, title);
  return ctx.json({ ok: true, kpiId: newId });
}

async function kpiCorporateDelete(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const kpiId = ctx.clean(input.kpiId);
  if (!kpiId) throw new Error("kpiId is required.");
  await env.DB.prepare("DELETE FROM kpi_department_assignments WHERE kpi_id = ?").bind(kpiId).run();
  await env.DB.prepare("DELETE FROM kpi_corporate WHERE kpi_id = ?").bind(kpiId).run();
  await ctx.logAdminAction(env, user, "kpi_corporate_delete", kpiId, "");
  return ctx.json({ ok: true });
}

// Assign a KPI to a set of departments; weight_allocated = kpi.weight / (จำนวนฝ่าย) auto-split.
// Replace semantics: the given set becomes the KPI's full department set.
async function kpiCorporateAssign(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const kpiId = ctx.clean(input.kpiId);
  if (!kpiId) throw new Error("kpiId is required.");
  const kpi = await env.DB.prepare("SELECT kpi_id, weight FROM kpi_corporate WHERE kpi_id = ? LIMIT 1").bind(kpiId).first();
  if (!kpi) throw new Error("ไม่พบ KPI");
  const uniq = [...new Set((Array.isArray(input.departments) ? input.departments : []).map(d => ctx.clean(d)).filter(Boolean))];
  const ts = ctx.nowIso();
  await env.DB.prepare("DELETE FROM kpi_department_assignments WHERE kpi_id = ?").bind(kpiId).run();
  const per = uniq.length ? Math.round((Number(kpi.weight || 0) / uniq.length) * 100) / 100 : 0;
  for (const d of uniq) {
    await env.DB.prepare("INSERT INTO kpi_department_assignments(assignment_id, kpi_id, department, weight_allocated, assigned_by, assigned_at) VALUES(?, ?, ?, ?, ?, ?)")
      .bind(await ctx.nextId(env, "KDA"), kpiId, d, per, user.user_id, ts).run();
  }
  await ctx.logAdminAction(env, user, "kpi_assign_dept", kpiId, uniq.join(", "));
  return ctx.json({ ok: true, count: uniq.length, weightEach: per });
}

// Publish a cycle: requires weight sum = 100 AND every KPI assigned to ≥1 department.
async function kpiPublish(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const kres = await env.DB.prepare("SELECT kpi_id, weight FROM kpi_corporate WHERE cycle_id = ?").bind(cycleId).all();
  const kpis = kres.results || [];
  if (!kpis.length) throw new Error("รอบนี้ยังไม่มี KPI");
  const sum = kpis.reduce((s, k) => s + Number(k.weight || 0), 0);
  if (Math.abs(sum - 100) > 0.01) throw new Error(`น้ำหนักรวมต้องได้ 100 ก่อนเผยแพร่ (ตอนนี้ ${Math.round(sum * 100) / 100})`);
  const asgRes = await env.DB.prepare("SELECT DISTINCT a.kpi_id FROM kpi_department_assignments a JOIN kpi_corporate k ON k.kpi_id = a.kpi_id WHERE k.cycle_id = ?").bind(cycleId).all();
  const assigned = new Set((asgRes.results || []).map(r => r.kpi_id));
  const unassigned = kpis.filter(k => !assigned.has(k.kpi_id)).length;
  if (unassigned) throw new Error(`ยังมี KPI ที่ยังไม่ได้มอบหมายฝ่าย ${unassigned} ข้อ`);
  const ts = ctx.nowIso();
  await env.DB.prepare("UPDATE kpi_corporate SET status = 'published', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await env.DB.prepare("UPDATE kpi_cycles SET status = 'active', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await ctx.logAdminAction(env, user, "kpi_publish", cycleId, `${kpis.length} KPI`);
  return ctx.json({ ok: true });
}

// Revert a published cycle to draft (escape hatch to fix mistakes; safe while no scores exist yet).
async function kpiUnpublish(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const ts = ctx.nowIso();
  await env.DB.prepare("UPDATE kpi_corporate SET status = 'draft', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await env.DB.prepare("UPDATE kpi_cycles SET status = 'draft', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await ctx.logAdminAction(env, user, "kpi_unpublish", cycleId, "");
  return ctx.json({ ok: true });
}

// ============================================================================
// ก้อน 3c — หัวหน้าฝ่าย: เห็น KPI ที่ฝ่ายได้รับ → ตั้งเกณฑ์ grade 1-5 → แจกให้พนักงาน
// role เดิมไม่มี "head"; HR แต่งตั้งหัวหน้าฝ่ายผ่าน kpi_department_heads (department → user).
// ============================================================================

// HR แต่งตั้ง/ถอดถอนหัวหน้าฝ่าย (1 คน/ฝ่าย). userId ว่าง = ล้างค่า.
async function kpiHeadsSave(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const department = ctx.clean(input.department);
  if (!department) throw new Error("ต้องระบุฝ่าย (department)");
  const userId = ctx.clean(input.userId) || null;
  const ts = ctx.nowIso();
  if (userId) {
    await env.DB.prepare(`INSERT INTO kpi_department_heads(department, user_id, assigned_by, assigned_at) VALUES(?,?,?,?)
      ON CONFLICT(department) DO UPDATE SET user_id=excluded.user_id, assigned_by=excluded.assigned_by, assigned_at=excluded.assigned_at`)
      .bind(department, userId, user.user_id, ts).run();
  } else {
    await env.DB.prepare("DELETE FROM kpi_department_heads WHERE department = ?").bind(department).run();
  }
  await ctx.logAdminAction(env, user, "kpi_set_head", department, userId || "(ล้างค่า)");
  return ctx.json({ ok: true });
}

// Resolve the current actor + the departments they head. HR can act on any department (pass input.department);
// a non-HR actor may only touch departments where they are the appointed head.
async function resolveHeadContext(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const isHR = user.role === "HR";
  const res = await env.DB.prepare("SELECT department FROM kpi_department_heads WHERE user_id = ?").bind(user.user_id).all();
  const headDepts = (res.results || []).map(r => r.department);
  return { input, user, isHR, headDepts };
}

function assertHeadOf(hc, department) {
  if (hc.isHR) return;                 // HR may act on any department
  if (!hc.headDepts.includes(department)) throw new Error("คุณไม่ใช่หัวหน้าของฝ่ายนี้");
}

// หัวหน้าฝ่าย: KPI (published) ที่แต่ละฝ่ายของตัวเองได้รับ + เกณฑ์ grade + คนที่แจกไปแล้ว + รายชื่อผู้สมัคร.
async function kpiDeptOverview(request, env, ctx) {
  const hc = await resolveHeadContext(request, env, ctx);
  const askDept = ctx.clean(hc.input.department);
  // HR previewing a specific dept, otherwise the actor's own head departments.
  let depts = hc.headDepts;
  if (askDept && (hc.isHR || hc.headDepts.includes(askDept))) depts = [askDept];
  if (!depts.length) return ctx.json({ ok: true, managedDepartments: [], cycle: null, departments: [] });

  // Heads work on the currently active (published) cycle.
  const cyc = await env.DB.prepare("SELECT * FROM kpi_cycles WHERE status = 'active' ORDER BY cycle_year DESC, cycle_period ASC LIMIT 1").first();
  const cycle = cyc ? { cycleId: cyc.cycle_id, year: cyc.cycle_year, period: cyc.cycle_period, status: cyc.status, startDate: cyc.start_date, dueDate: cyc.due_date } : null;

  const nameOf = {};
  const departments = [];
  for (const dep of depts) {
    const uRes = await env.DB.prepare("SELECT user_id, name FROM users WHERE active = 1 AND department = ? ORDER BY name").bind(dep).all();
    const candidates = (uRes.results || []).map(u => ({ userId: u.user_id, name: u.name || u.user_id }));
    candidates.forEach(c => { nameOf[c.userId] = c.name; });
    // all sub-KPIs the head created in this department (grouped by parent below)
    const subRes = await env.DB.prepare("SELECT * FROM kpi_sub WHERE department = ? ORDER BY created_at").bind(dep).all();
    const pRes = await env.DB.prepare("SELECT p.sub_id, p.month_no, p.value, p.note FROM kpi_progress p JOIN kpi_sub s ON s.sub_id = p.sub_id WHERE s.department = ? ORDER BY p.month_no").bind(dep).all();
    const progBy = {};
    (pRes.results || []).forEach(p => { (progBy[p.sub_id] = progBy[p.sub_id] || []).push({ monthNo: p.month_no, value: p.value, note: p.note }); });
    const subs = (subRes.results || []).map(s => ({
      subId: s.sub_id, parentKpiId: s.parent_kpi_id, userId: s.user_id, userName: nameOf[s.user_id] || null,
      title: s.title, target: s.target, unit: s.unit, weight: s.weight, criteria: [s.g1, s.g2, s.g3, s.g4, s.g5],
      actualResult: s.actual_result, selfGrade: s.self_grade, selfSubmittedAt: s.self_submitted_at,
      finalGrade: s.final_grade, approvedAt: s.approved_at, progress: progBy[s.sub_id] || []
    }));
    const personalSubs = subs.filter(s => !s.parentKpiId);
    const kpis = [];
    if (cycle) {
      const kRes = await env.DB.prepare(`
        SELECT k.kpi_id, k.title, k.weight, k.target, k.unit, k.perspective, a.weight_allocated
        FROM kpi_department_assignments a JOIN kpi_corporate k ON k.kpi_id = a.kpi_id
        WHERE a.department = ? AND k.cycle_id = ? AND k.status = 'published'
        ORDER BY k.perspective, k.created_at`).bind(dep, cycle.cycleId).all();
      for (const k of (kRes.results || [])) {
        kpis.push({
          kpiId: k.kpi_id, title: k.title, weight: k.weight, weightAllocated: k.weight_allocated,
          target: k.target, unit: k.unit, perspective: k.perspective,
          subs: subs.filter(s => s.parentKpiId === k.kpi_id)
        });
      }
    }
    departments.push({ department: dep, candidates, kpis, personalSubs });
  }
  return ctx.json({ ok: true, managedDepartments: depts, cycle, departments });
}

// Guard: the KPI must be published AND assigned to this department. Returns nothing / throws.
async function assertKpiInDept(env, kpiId, department) {
  const ok = await env.DB.prepare(`SELECT 1 FROM kpi_department_assignments a JOIN kpi_corporate k ON k.kpi_id = a.kpi_id
    WHERE a.kpi_id = ? AND a.department = ? AND k.status = 'published' LIMIT 1`).bind(kpiId, department).first();
  if (!ok) throw new Error("KPI นี้ไม่ได้อยู่ในฝ่ายของคุณ (หรือยังไม่เผยแพร่)");
}

// หัวหน้าฝ่ายตั้งเกณฑ์ grade 1-5 (คำอธิบายข้อความต่อ grade) สำหรับ KPI หนึ่งในฝ่ายตัวเอง.
async function kpiDeptCriteriaSave(request, env, ctx) {
  const hc = await resolveHeadContext(request, env, ctx);
  const kpiId = ctx.clean(hc.input.kpiId);
  const department = ctx.clean(hc.input.department);
  if (!kpiId || !department) throw new Error("kpiId และ department จำเป็น");
  assertHeadOf(hc, department);
  await assertKpiInDept(env, kpiId, department);
  const g = Array.isArray(hc.input.grades) ? hc.input.grades : [];
  const gv = i => ctx.clean(g[i]) || null;
  const ts = ctx.nowIso();
  await env.DB.prepare(`INSERT INTO kpi_grade_criteria(kpi_id, department, g1, g2, g3, g4, g5, updated_by, updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(kpi_id, department) DO UPDATE SET g1=excluded.g1, g2=excluded.g2, g3=excluded.g3, g4=excluded.g4, g5=excluded.g5, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .bind(kpiId, department, gv(0), gv(1), gv(2), gv(3), gv(4), hc.user.user_id, ts).run();
  await ctx.logAdminAction(env, hc.user, "kpi_grade_criteria", kpiId, department);
  return ctx.json({ ok: true });
}

// หัวหน้าฝ่ายแจก KPI ให้พนักงานในฝ่าย (replace-set). ต้องตั้งเกณฑ์ grade ครบ 5 ระดับก่อน (north star).
async function kpiDeptAssign(request, env, ctx) {
  const hc = await resolveHeadContext(request, env, ctx);
  const kpiId = ctx.clean(hc.input.kpiId);
  const department = ctx.clean(hc.input.department);
  if (!kpiId || !department) throw new Error("kpiId และ department จำเป็น");
  assertHeadOf(hc, department);
  await assertKpiInDept(env, kpiId, department);
  const cr = await env.DB.prepare("SELECT g1,g2,g3,g4,g5 FROM kpi_grade_criteria WHERE kpi_id = ? AND department = ?").bind(kpiId, department).first();
  if (!cr || ![cr.g1, cr.g2, cr.g3, cr.g4, cr.g5].every(v => String(v || "").trim())) {
    throw new Error("ตั้งเกณฑ์ให้คะแนน (grade 1-5) ให้ครบก่อนแจกให้พนักงาน");
  }
  const wanted = [...new Set((Array.isArray(hc.input.userIds) ? hc.input.userIds : []).map(u => ctx.clean(u)).filter(Boolean))];
  let valid = [];
  if (wanted.length) {
    const uRes = await env.DB.prepare("SELECT user_id FROM users WHERE active = 1 AND department = ?").bind(department).all();
    const allowed = new Set((uRes.results || []).map(r => r.user_id));
    valid = wanted.filter(u => allowed.has(u));
  }
  const ts = ctx.nowIso();
  await env.DB.prepare("DELETE FROM kpi_individual_assignments WHERE kpi_id = ? AND department = ?").bind(kpiId, department).run();
  for (const uid of valid) {
    await env.DB.prepare("INSERT INTO kpi_individual_assignments(ind_assignment_id, kpi_id, department, user_id, assigned_by, assigned_at) VALUES(?,?,?,?,?,?)")
      .bind(await ctx.nextId(env, "KIA"), kpiId, department, uid, hc.user.user_id, ts).run();
  }
  await ctx.logAdminAction(env, hc.user, "kpi_assign_individual", kpiId, `${department}: ${valid.length} คน`);
  return ctx.json({ ok: true, count: valid.length });
}

// ก้อน 4: หัวหน้าสร้าง/แก้ KPI ย่อย (แตกจาก KPI องค์กร หรือ KPI เฉพาะบุคคลถ้า parentKpiId ว่าง).
async function kpiSubSave(request, env, ctx) {
  const hc = await resolveHeadContext(request, env, ctx);
  const department = ctx.clean(hc.input.department);
  if (!department) throw new Error("department จำเป็น");
  assertHeadOf(hc, department);
  const title = ctx.clean(hc.input.title);
  if (!title) throw new Error("กรุณาใส่ชื่อ KPI ย่อย");
  const parentKpiId = ctx.clean(hc.input.parentKpiId) || null;
  let cycleId = null;
  if (parentKpiId) {
    await assertKpiInDept(env, parentKpiId, department);            // KPI องค์กรต้อง published + อยู่ในฝ่ายนี้
    const k = await env.DB.prepare("SELECT cycle_id FROM kpi_corporate WHERE kpi_id = ?").bind(parentKpiId).first();
    cycleId = k ? k.cycle_id : null;
  } else {
    const cyc = await env.DB.prepare("SELECT cycle_id FROM kpi_cycles WHERE status = 'active' ORDER BY cycle_year DESC, cycle_period ASC LIMIT 1").first();
    cycleId = cyc ? cyc.cycle_id : null;
  }
  const userId = ctx.clean(hc.input.userId) || null;
  if (userId) {
    const ok = await env.DB.prepare("SELECT 1 FROM users WHERE user_id = ? AND active = 1 AND department = ? LIMIT 1").bind(userId, department).first();
    if (!ok) throw new Error("พนักงานที่เลือกไม่อยู่ในฝ่ายนี้");
  }
  const weightRaw = ctx.clean(hc.input.weight);
  const weight = weightRaw === "" ? null : Number(weightRaw);
  if (weight != null && (!(weight >= 0) || weight > 100)) throw new Error("น้ำหนักต้องอยู่ในช่วง 0-100");
  const g = Array.isArray(hc.input.grades) ? hc.input.grades : [];
  const gv = i => ctx.clean(g[i]) || null;
  const ts = ctx.nowIso();
  const tail = [parentKpiId, cycleId, department, userId, title, ctx.clean(hc.input.target), ctx.clean(hc.input.unit), weight, gv(0), gv(1), gv(2), gv(3), gv(4)];
  const subId = ctx.clean(hc.input.subId);
  if (subId) {
    const existing = await env.DB.prepare("SELECT department FROM kpi_sub WHERE sub_id = ?").bind(subId).first();
    if (!existing) throw new Error("ไม่พบ KPI ย่อย");
    assertHeadOf(hc, existing.department);
    await env.DB.prepare("UPDATE kpi_sub SET parent_kpi_id=?, cycle_id=?, department=?, user_id=?, title=?, target=?, unit=?, weight=?, g1=?, g2=?, g3=?, g4=?, g5=?, updated_at=? WHERE sub_id=?")
      .bind(...tail, ts, subId).run();
    await ctx.logAdminAction(env, hc.user, "kpi_sub_update", subId, title);
    return ctx.json({ ok: true, subId });
  }
  const newId = await ctx.nextId(env, "KSUB");
  await env.DB.prepare("INSERT INTO kpi_sub(sub_id, parent_kpi_id, cycle_id, department, user_id, title, target, unit, weight, g1, g2, g3, g4, g5, created_by, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(newId, ...tail, hc.user.user_id, ts, ts).run();
  await ctx.logAdminAction(env, hc.user, "kpi_sub_create", newId, title);
  return ctx.json({ ok: true, subId: newId });
}

async function kpiSubDelete(request, env, ctx) {
  const hc = await resolveHeadContext(request, env, ctx);
  const subId = ctx.clean(hc.input.subId);
  if (!subId) throw new Error("subId จำเป็น");
  const existing = await env.DB.prepare("SELECT department FROM kpi_sub WHERE sub_id = ?").bind(subId).first();
  if (!existing) return ctx.json({ ok: true });
  assertHeadOf(hc, existing.department);
  await env.DB.prepare("DELETE FROM kpi_sub WHERE sub_id = ?").bind(subId).run();
  await ctx.logAdminAction(env, hc.user, "kpi_sub_delete", subId, "");
  return ctx.json({ ok: true });
}

// ก้อน 4 chunk 2: พนักงานดู KPI ย่อยที่ถูกแจกให้ตัวเอง (พร้อมเกณฑ์ + ผลที่กรอกไว้).
async function kpiMyList(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const res = await env.DB.prepare(`
    SELECT s.*, k.title AS parent_title, c.cycle_period, c.start_date AS cycle_start
    FROM kpi_sub s
    LEFT JOIN kpi_corporate k ON k.kpi_id = s.parent_kpi_id
    LEFT JOIN kpi_cycles c ON c.cycle_id = s.cycle_id
    WHERE s.user_id = ? ORDER BY s.created_at`).bind(user.user_id).all();
  const pRes = await env.DB.prepare(`
    SELECT p.sub_id, p.month_no, p.value, p.note FROM kpi_progress p
    JOIN kpi_sub s ON s.sub_id = p.sub_id WHERE s.user_id = ? ORDER BY p.month_no`).bind(user.user_id).all();
  const progBy = {};
  (pRes.results || []).forEach(p => { (progBy[p.sub_id] = progBy[p.sub_id] || []).push({ monthNo: p.month_no, value: p.value, note: p.note }); });
  const subs = (res.results || []).map(s => ({
    subId: s.sub_id, parentTitle: s.parent_title, department: s.department,
    title: s.title, target: s.target, unit: s.unit, weight: s.weight,
    criteria: [s.g1, s.g2, s.g3, s.g4, s.g5],
    actualResult: s.actual_result, selfGrade: s.self_grade, selfSubmittedAt: s.self_submitted_at,
    finalGrade: s.final_grade, approvedAt: s.approved_at,
    cyclePeriod: s.cycle_period, cycleStart: s.cycle_start, progress: progBy[s.sub_id] || []
  }));
  return ctx.json({ ok: true, subs });
}

// พนักงานกรอกผลจริง + ให้เกรดตัวเอง (แก้ได้จนกว่าหัวหน้า approve).
async function kpiMySubmit(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const subId = ctx.clean(input.subId);
  if (!subId) throw new Error("subId จำเป็น");
  const sub = await env.DB.prepare("SELECT user_id, approved_at FROM kpi_sub WHERE sub_id = ?").bind(subId).first();
  if (!sub) throw new Error("ไม่พบ KPI");
  if (sub.user_id !== user.user_id) throw new Error("KPI นี้ไม่ใช่ของคุณ");
  if (sub.approved_at) throw new Error("หัวหน้าอนุมัติเกรดแล้ว แก้ไขไม่ได้");
  const selfGrade = gradeOrNull(input.selfGrade, ctx);
  const ts = ctx.nowIso();
  // actual_result: อัปเดตเฉพาะเมื่อส่งมา (โฟลว์รายเดือนเป็นตัวจัดการ actual_result ปกติ)
  if (input.actualResult !== undefined && input.actualResult !== null) {
    await env.DB.prepare("UPDATE kpi_sub SET actual_result = ?, self_grade = ?, self_submitted_at = ? WHERE sub_id = ?")
      .bind(ctx.clean(input.actualResult), selfGrade, ts, subId).run();
  } else {
    await env.DB.prepare("UPDATE kpi_sub SET self_grade = ?, self_submitted_at = ? WHERE sub_id = ?")
      .bind(selfGrade, ts, subId).run();
  }
  return ctx.json({ ok: true });
}

// chunk 3b: พนักงานอัปเดตผลรายเดือน (upsert 1 แถว/เดือน) + sync actual_result = ค่าเดือนล่าสุด.
async function kpiProgressSave(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const subId = ctx.clean(input.subId);
  if (!subId) throw new Error("subId จำเป็น");
  const monthNo = Number(ctx.clean(input.monthNo));
  if (!Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12) throw new Error("เดือนไม่ถูกต้อง (1-12)");
  const sub = await env.DB.prepare("SELECT user_id, approved_at FROM kpi_sub WHERE sub_id = ?").bind(subId).first();
  if (!sub) throw new Error("ไม่พบ KPI");
  if (sub.user_id !== user.user_id) throw new Error("KPI นี้ไม่ใช่ของคุณ");
  if (sub.approved_at) throw new Error("หัวหน้าอนุมัติแล้ว แก้ไขไม่ได้");
  const value = ctx.clean(input.value);
  const note = ctx.clean(input.note);
  const ts = ctx.nowIso();
  await env.DB.prepare(`INSERT INTO kpi_progress(progress_id, sub_id, month_no, value, note, updated_at)
    VALUES(?, ?, ?, ?, ?, ?)
    ON CONFLICT(sub_id, month_no) DO UPDATE SET value=excluded.value, note=excluded.note, updated_at=excluded.updated_at`)
    .bind(await ctx.nextId(env, "KPRG"), subId, monthNo, value, note, ts).run();
  const latest = await env.DB.prepare("SELECT value FROM kpi_progress WHERE sub_id = ? AND value IS NOT NULL AND TRIM(value) <> '' ORDER BY month_no DESC LIMIT 1").bind(subId).first();
  await env.DB.prepare("UPDATE kpi_sub SET actual_result = ? WHERE sub_id = ?").bind(latest ? latest.value : null, subId).run();
  return ctx.json({ ok: true });
}

// หัวหน้าฝ่าย approve เกรดสุดท้าย (เห็น self-grade แล้วยืนยัน/แก้). approve แล้วพนักงานแก้ผลไม่ได้.
async function kpiSubApprove(request, env, ctx) {
  const hc = await resolveHeadContext(request, env, ctx);
  const subId = ctx.clean(hc.input.subId);
  if (!subId) throw new Error("subId จำเป็น");
  const sub = await env.DB.prepare("SELECT department FROM kpi_sub WHERE sub_id = ?").bind(subId).first();
  if (!sub) throw new Error("ไม่พบ KPI");
  assertHeadOf(hc, sub.department);
  // finalGrade ว่าง = ยกเลิกอนุมัติ (escape hatch ให้พนักงานกลับมาแก้ได้)
  const raw = ctx.clean(hc.input.finalGrade);
  if (!raw) {
    await env.DB.prepare("UPDATE kpi_sub SET final_grade = NULL, approved_by = NULL, approved_at = NULL WHERE sub_id = ?").bind(subId).run();
    await ctx.logAdminAction(env, hc.user, "kpi_sub_unapprove", subId, "");
    return ctx.json({ ok: true, approved: false });
  }
  const finalGrade = gradeOrNull(raw, ctx);
  const ts = ctx.nowIso();
  await env.DB.prepare("UPDATE kpi_sub SET final_grade = ?, approved_by = ?, approved_at = ? WHERE sub_id = ?")
    .bind(finalGrade, hc.user.user_id, ts, subId).run();
  await ctx.logAdminAction(env, hc.user, "kpi_sub_approve", subId, "grade " + finalGrade);
  return ctx.json({ ok: true, approved: true });
}

// ก้อน 4 chunk 3a: คะแนน KPI ไหลรวมขึ้นองค์กร (HR/Exec ดูได้).
// per KPI: dept ratio = เฉลี่ยถ่วงของ sub ที่ approved ในฝ่ายนั้น · KPI ratio = เฉลี่ย dept · contribution = weight × ratio.
async function kpiDashboard(request, env, ctx) {
  const { input } = await ctx.requireViewer(request, env);   // HR หรือ Executive
  let cycleId = ctx.clean(input.cycleId);
  const cyclesRes = await env.DB.prepare("SELECT * FROM kpi_cycles ORDER BY cycle_year DESC, cycle_period ASC").all();
  const cycles = (cyclesRes.results || []).map(c => ({ cycleId: c.cycle_id, year: c.cycle_year, period: c.cycle_period, status: c.status }));
  if (!cycleId) {
    const active = cycles.find(c => c.status === "active");
    cycleId = active ? active.cycleId : (cycles[0] ? cycles[0].cycleId : null);
  }
  if (!cycleId) return ctx.json({ ok: true, cycles, cycleId: null, kpis: [], total: 0, scoredWeight: 0 });
  const cyc = cycles.find(c => c.cycleId === cycleId) || null;

  const kres = await env.DB.prepare("SELECT kpi_id, title, weight, perspective FROM kpi_corporate WHERE cycle_id = ? ORDER BY perspective, created_at").bind(cycleId).all();
  const kpis = kres.results || [];
  const sres = await env.DB.prepare("SELECT parent_kpi_id, department, weight, final_grade FROM kpi_sub WHERE cycle_id = ? AND parent_kpi_id IS NOT NULL AND final_grade IS NOT NULL").bind(cycleId).all();
  // group approved subs by kpi → dept (weighted numerator/denominator)
  const byKpi = {};
  (sres.results || []).forEach(s => {
    const km = (byKpi[s.parent_kpi_id] = byKpi[s.parent_kpi_id] || {});
    const dep = (km[s.department] = km[s.department] || { num: 0, w: 0 });
    const w = (s.weight == null) ? 1 : (Number(s.weight) || 0);
    const eff = w > 0 ? w : 1;
    dep.num += (Number(s.final_grade) / 5) * eff;
    dep.w += eff;
  });

  let total = 0, scoredWeight = 0;
  const rows = kpis.map(k => {
    const depMap = byKpi[k.kpi_id] || {};
    const depScores = Object.keys(depMap).map(department => {
      const v = depMap[department];
      return { department, pct: v.w ? Math.round((v.num / v.w) * 100) : null };
    }).filter(d => d.pct != null);
    const ratio = depScores.length ? (depScores.reduce((a, d) => a + d.pct, 0) / depScores.length / 100) : null;
    const weight = Number(k.weight || 0);
    if (ratio != null) { total += weight * ratio; scoredWeight += weight; }
    return {
      kpiId: k.kpi_id, title: k.title, perspective: k.perspective, weight,
      pct: ratio != null ? Math.round(ratio * 100) : null,
      contribution: ratio != null ? Math.round(weight * ratio * 100) / 100 : null,
      depScores
    };
  });
  return ctx.json({ ok: true, cycle: cyc, cycles, cycleId, kpis: rows, total: Math.round(total * 100) / 100, scoredWeight: Math.round(scoredWeight * 100) / 100 });
}
