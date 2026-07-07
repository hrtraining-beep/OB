/* ============================================================================
 * KPI System — frontend module (see PROJECT_KPI.md + HANDOFF_M3.md §0.1)
 * ----------------------------------------------------------------------------
 * RULES (cross-session discipline — do not break):
 *  - Self-contained. Talk to the rest of the app ONLY through `window.NT` (the bridge).
 *    Do NOT copy helpers out of app.js, and do NOT edit app.js internals from here.
 *  - Register the public entry as `window.KPI = { renderHome }`.
 *  - Reuse M3 look via NT.m3Shell / NT.micon so it matches the rest of the app.
 *  - North star: every KPI result should show number + meaning + next step, not a bare number.
 * ========================================================================== */
(function () {
  const NT = window.NT;
  if (!NT) { console.error('[KPI] bridge window.NT missing — check script load order in index.html'); return; }

  async function renderHome() {
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px">
        <h2 class="m3-title">ระบบ KPI</h2>
        <p class="m3-eyebrow">กำลังพัฒนา — ตอนนี้ยังเป็นโครงเปล่าเพื่อทดสอบการเชื่อมต่อ</p>
      </section>
      <section class="m3-section"><div class="m3-card m3-card-pad" id="kpiPing">${NT.micon('sync')} กำลังตรวจการเชื่อมต่อหลังบ้าน...</div></section>
    `, { bar: { title: 'ระบบ KPI', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => NT.goProfile() });
    try {
      const r = await NT.api('/kpi/ping');
      const el = document.getElementById('kpiPing');
      if (el) el.innerHTML = `${NT.micon('check_circle')} เชื่อมต่อโมดูล KPI สำเร็จ · <strong>${NT.escapeHtml(r.status || '-')}</strong>`;
    } catch (e) {
      const el = document.getElementById('kpiPing');
      if (el) el.innerHTML = `${NT.micon('error')} เชื่อมต่อไม่สำเร็จ: ${NT.escapeHtml(e.message || '')}`;
    }
  }

  window.KPI = { renderHome };
})();
