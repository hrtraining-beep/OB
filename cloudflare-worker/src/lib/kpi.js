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
}

export async function handleKpi(path, request, env, ctx) {
  await ensureKpiTables(env);
  if (path === "/kpi/overview") return kpiOverview(request, env, ctx);
  if (path === "/kpi/cycle/save") return kpiCycleSave(request, env, ctx);
  if (path === "/kpi/cycle/delete") return kpiCycleDelete(request, env, ctx);
  if (path === "/kpi/corporate/save") return kpiCorporateSave(request, env, ctx);
  if (path === "/kpi/corporate/delete") return kpiCorporateDelete(request, env, ctx);
  return ctx.json({ ok: false, error: "Unknown KPI route." }, 404);
}

// Cycles + the Corporate KPIs of one cycle (default = latest). Weight sum computed on the client.
async function kpiOverview(request, env, ctx) {
  const { input } = await ctx.requireAdmin(request, env);
  const cyclesRes = await env.DB.prepare("SELECT * FROM kpi_cycles ORDER BY cycle_year DESC, cycle_period ASC").all();
  const cycles = (cyclesRes.results || []).map(c => ({ cycleId: c.cycle_id, year: c.cycle_year, period: c.cycle_period, status: c.status, startDate: c.start_date, dueDate: c.due_date }));
  let cycleId = ctx.clean(input.cycleId);
  if ((!cycleId || !cycles.some(c => c.cycleId === cycleId)) && cycles.length) cycleId = cycles[0].cycleId;
  let kpis = [];
  if (cycleId) {
    const kres = await env.DB.prepare("SELECT * FROM kpi_corporate WHERE cycle_id = ? ORDER BY perspective, objective_code, kpi_code, created_at").bind(cycleId).all();
    kpis = (kres.results || []).map(k => ({
      kpiId: k.kpi_id, perspective: k.perspective, objectiveCode: k.objective_code, kpiCode: k.kpi_code,
      title: k.title, weight: k.weight, target: k.target, unit: k.unit, deadline: k.deadline, status: k.status
    }));
  }
  return ctx.json({ ok: true, cycles, cycleId: cycleId || null, kpis, perspectives: PERSPECTIVES });
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
  await env.DB.prepare("DELETE FROM kpi_corporate WHERE kpi_id = ?").bind(kpiId).run();
  await ctx.logAdminAction(env, user, "kpi_corporate_delete", kpiId, "");
  return ctx.json({ ok: true });
}
