/* ============================================================================
 * 360° Feedback System — frontend module (see PROJECT_360.md + HANDOFF_M3.md §0.1)
 * ----------------------------------------------------------------------------
 * RULES (cross-session discipline — do not break):
 *  - Self-contained. Talk to the app ONLY through `window.NT`. Do NOT copy helpers or edit app.js.
 *  - Register the public entry as `window.FB360 = { renderHome }`.
 *  - North star: the gap report the employee sees must lead with WORDS (what to develop), not numbers.
 * ========================================================================== */
(function () {
  const NT = window.NT;
  if (!NT) { console.error('[FB360] bridge window.NT missing — check script load order in index.html'); return; }

  async function renderHome() {
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px">
        <h2 class="m3-title">360° Feedback</h2>
        <p class="m3-eyebrow">กำลังพัฒนา — ตอนนี้ยังเป็นโครงเปล่าเพื่อทดสอบการเชื่อมต่อ</p>
      </section>
      <section class="m3-section"><div class="m3-card m3-card-pad" id="fb360Ping">${NT.micon('sync')} กำลังตรวจการเชื่อมต่อหลังบ้าน...</div></section>
    `, { bar: { title: '360° Feedback', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => NT.goProfile() });
    try {
      const r = await NT.api('/360/ping');
      const el = document.getElementById('fb360Ping');
      if (el) el.innerHTML = `${NT.micon('check_circle')} เชื่อมต่อโมดูล 360 สำเร็จ · <strong>${NT.escapeHtml(r.status || '-')}</strong>`;
    } catch (e) {
      const el = document.getElementById('fb360Ping');
      if (el) el.innerHTML = `${NT.micon('error')} เชื่อมต่อไม่สำเร็จ: ${NT.escapeHtml(e.message || '')}`;
    }
  }

  window.FB360 = { renderHome };
})();
