// ============================================================================
// 360° Feedback System — backend handlers (see PROJECT_360.md + HANDOFF_M3.md §0.1)
// ----------------------------------------------------------------------------
// RULES (do not break — cross-session discipline):
//  - This file is ADDITIVE. It must never require changes to existing worker.js logic.
//  - Shared helpers arrive via `ctx`. Do NOT re-import/duplicate them or reach back into worker.js.
//  - All new tables use CREATE TABLE IF NOT EXISTS (lazy). Only ADD nullable columns to existing tables.
//  - Routes are namespaced under /360/*.
//  - North star: output must be gap + WORDS (development guidance), not numbers alone.
// ============================================================================

export async function handle360(path, request, env, ctx) {
  // Scaffold only — proves the bridge works. Real 360 routes (cycles/pairing/responses/gap) come later.
  if (path === "/360/ping") {
    return ctx.json({ ok: true, module: "feedback360", status: "scaffold", at: ctx.nowIso() });
  }
  return ctx.json({ ok: false, error: "Unknown 360 route." }, 404);
}
