// ============================================================================
// KPI System — backend handlers (see PROJECT_KPI.md + HANDOFF_M3.md §0.1)
// ----------------------------------------------------------------------------
// RULES (do not break — cross-session discipline):
//  - This file is ADDITIVE. It must never require changes to existing worker.js logic.
//  - Shared helpers arrive via `ctx` (json, clean, nowIso, requireAdmin, ...). Do NOT re-import
//    or duplicate them, and do NOT reach back into worker.js.
//  - All new tables use CREATE TABLE IF NOT EXISTS (lazy). Never ALTER/DROP an existing table's
//    columns; only ADD nullable columns.
//  - Routes are namespaced under /kpi/*.
// ============================================================================

export async function handleKpi(path, request, env, ctx) {
  // Scaffold only — proves the bridge (worker route → this module → ctx helpers) works end to end.
  // Real KPI routes (corporate/dept/individual/approve/dashboard) get added on top of this later.
  if (path === "/kpi/ping") {
    return ctx.json({ ok: true, module: "kpi", status: "scaffold", at: ctx.nowIso() });
  }
  return ctx.json({ ok: false, error: "Unknown KPI route." }, 404);
}
