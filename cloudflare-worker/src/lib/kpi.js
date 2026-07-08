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

  const departments = [];
  for (const dep of depts) {
    const uRes = await env.DB.prepare("SELECT user_id, name FROM users WHERE active = 1 AND department = ? ORDER BY name").bind(dep).all();
    const candidates = (uRes.results || []).map(u => ({ userId: u.user_id, name: u.name || u.user_id }));
    const kpis = [];
    if (cycle) {
      const kRes = await env.DB.prepare(`
        SELECT k.kpi_id, k.title, k.weight, k.target, k.unit, k.perspective, a.weight_allocated
        FROM kpi_department_assignments a JOIN kpi_corporate k ON k.kpi_id = a.kpi_id
        WHERE a.department = ? AND k.cycle_id = ? AND k.status = 'published'
        ORDER BY k.perspective, k.created_at`).bind(dep, cycle.cycleId).all();
      for (const k of (kRes.results || [])) {
        const cr = await env.DB.prepare("SELECT g1,g2,g3,g4,g5 FROM kpi_grade_criteria WHERE kpi_id = ? AND department = ?").bind(k.kpi_id, dep).first();
        const asg = await env.DB.prepare("SELECT user_id FROM kpi_individual_assignments WHERE kpi_id = ? AND department = ?").bind(k.kpi_id, dep).all();
        kpis.push({
          kpiId: k.kpi_id, title: k.title, weight: k.weight, weightAllocated: k.weight_allocated,
          target: k.target, unit: k.unit, perspective: k.perspective,
          criteria: cr ? [cr.g1, cr.g2, cr.g3, cr.g4, cr.g5] : null,
          assignedUserIds: (asg.results || []).map(r => r.user_id)
        });
      }
    }
    departments.push({ department: dep, candidates, kpis });
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
