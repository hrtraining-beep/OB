/* ============================================================================
 * KPI System — frontend module (see PROJECT_KPI.md + HANDOFF_M3.md §0.1)
 * ก้อน 3a: Admin — รอบ (cycle) + Corporate KPI (สร้าง/แก้/ลบ + น้ำหนักรวม)
 * RULES: self-contained; talk to the app ONLY via window.NT; register window.KPI = { renderHome }.
 * ========================================================================== */
(function () {
  const NT = window.NT;
  if (!NT) { console.error('[KPI] bridge window.NT missing'); return; }

  const state = { cycleId: null, cycles: [], kpis: [], perspectives: [] };
  const esc = NT.escapeHtml, mi = NT.micon;

  async function load(cycleId) {
    const d = await NT.api('/kpi/overview', cycleId ? { cycleId } : {});
    state.cycles = d.cycles || [];
    state.kpis = d.kpis || [];
    state.cycleId = d.cycleId || null;
    state.perspectives = d.perspectives || [];
  }

  const cycleLabel = c => `ปี ${c.year} · ${c.period}`;
  const weightSum = () => state.kpis.reduce((s, k) => s + Number(k.weight || 0), 0);

  async function renderHome() {
    NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('sync')} กำลังโหลดข้อมูล KPI...</div></section>`, { bar: { title: 'ระบบ KPI', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => NT.goProfile() });
    try { await load(state.cycleId); paint(); }
    catch (e) { NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} โหลดไม่สำเร็จ: ${esc(e.message || '')}</div></section>`, { bar: { title: 'ระบบ KPI', back: true }, noNav: true })); NT.wireM3Nav({ back: () => NT.goProfile() }); }
  }

  function paint() {
    if (!state.cycles.length) {
      NT.render(NT.m3Shell('profile', `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">ระบบ KPI</h2><p class="m3-eyebrow">ยังไม่มีรอบประเมิน — สร้างรอบแรกเพื่อเริ่ม</p></section>
        <section class="m3-section"><button type="button" class="m3-btn" id="kNewCycle">${mi('add')}สร้างรอบ KPI</button></section>`, { bar: { title: 'ระบบ KPI', back: true }, noNav: true }));
      NT.wireM3Nav({ back: () => NT.goProfile() });
      document.getElementById('kNewCycle').addEventListener('click', renderCycleForm);
      return;
    }
    const sum = Math.round(weightSum() * 100) / 100;
    const groups = state.perspectives.map(p => {
      const items = state.kpis.filter(k => k.perspective === p);
      if (!items.length) return '';
      return `<div class="m3-section-label" style="margin-top:12px">${esc(p)}</div>${items.map(kpiCard).join('')}`;
    }).join('');
    const noPersp = state.kpis.filter(k => !state.perspectives.includes(k.perspective));
    const noPerspHtml = noPersp.length ? `<div class="m3-section-label" style="margin-top:12px">ไม่ระบุ Perspective</div>${noPersp.map(kpiCard).join('')}` : '';

    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:8px">
        <h2 class="m3-title">ระบบ KPI · Corporate</h2>
        <select class="m3-select" id="kCycleSel">${state.cycles.map(c => `<option value="${esc(c.cycleId)}" ${c.cycleId === state.cycleId ? 'selected' : ''}>${esc(cycleLabel(c))}${c.status !== 'draft' ? ' · ' + esc(c.status) : ''}</option>`).join('')}</select>
        <button type="button" class="m3-btn m3-btn--ghost" id="kNewCycle" style="min-height:44px">${mi('add')}สร้างรอบใหม่</button>
        <div class="m3-card m3-card-pad" style="display:flex;justify-content:space-between;align-items:center">
          <span class="m3-progress-cap">น้ำหนักรวมทุก KPI</span>
          <span class="m3-badge ${sum === 100 ? 'm3-badge--ok' : 'm3-badge--warn'}">${sum} / 100</span>
        </div>
        <p class="m3-save-hint" style="text-align:left">น้ำหนักรวมต้องได้ 100% ก่อน publish (ก้อนถัดไป) · เกณฑ์ให้คะแนน (grade) หัวหน้าฝ่ายเป็นผู้กำหนดตอนแจก KPI</p>
      </section>
      <section class="m3-section">
        ${state.kpis.length ? (groups + noPerspHtml) : '<div class="m3-empty">ยังไม่มี KPI ในรอบนี้ · กด “เพิ่ม KPI” ด้านล่าง</div>'}
      </section>
      <section class="m3-section"><button type="button" class="m3-btn" id="kAddKpi">${mi('add')}เพิ่ม KPI</button></section>
      <div style="height:30px"></div>`, { bar: { title: 'ระบบ KPI', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => NT.goProfile() });

    document.getElementById('kNewCycle').addEventListener('click', renderCycleForm);
    document.getElementById('kAddKpi').addEventListener('click', () => renderKpiForm(null));
    document.getElementById('kCycleSel').addEventListener('change', async e => { await load(e.target.value); paint(); });
    document.querySelectorAll('[data-kpi-edit]').forEach(b => b.addEventListener('click', () => renderKpiForm(state.kpis.find(k => k.kpiId === b.dataset.kpiEdit))));
    document.querySelectorAll('[data-kpi-del]').forEach(b => b.addEventListener('click', () => deleteKpi(b.dataset.kpiDel)));
  }

  function kpiCard(k) {
    return `
      <div class="m3-card m3-card-pad" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div class="m3-staff-name">${esc(k.title)}</div>
            <div class="m3-staff-role">${k.target ? 'เป้า ' + esc(k.target) + (k.unit ? ' ' + esc(k.unit) : '') : 'ยังไม่ตั้งเป้า'}${k.deadline ? ' · ' + esc(NT.formatThaiDate(k.deadline)) : ''}</div>
          </div>
          <span class="m3-badge">${Number(k.weight || 0)}%</span>
        </div>
        <div class="m3-tpl-actions" style="margin-top:10px">
          <button type="button" class="m3-btn m3-btn--tonal" data-kpi-edit="${esc(k.kpiId)}">${mi('edit')}แก้ไข</button>
          <button type="button" class="m3-btn m3-btn--ghost" data-kpi-del="${esc(k.kpiId)}" style="color:var(--m3-error)">${mi('delete')}ลบ</button>
        </div>
      </div>`;
  }

  function renderCycleForm() {
    const now = state.cycles[0] ? state.cycles[0].year : 2569;
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">สร้างรอบ KPI</h2><p class="m3-eyebrow">1 ปีมี 2 รอบ (H1/H2) หรือเลือก Full ทั้งปี</p></section>
      <form id="kCycleForm" class="m3-section">
        <label class="m3-elabel">ปี (พ.ศ.)</label><input class="m3-input" type="number" name="year" value="${now}" inputmode="numeric" required>
        <label class="m3-elabel">รอบ</label>
        <select class="m3-select" name="period">${['H1', 'H2', 'Full'].map(p => `<option value="${p}">${p}</option>`).join('')}</select>
        <button type="submit" class="m3-btn" style="margin-top:16px">${mi('save')}สร้างรอบ</button>
      </form><div style="height:30px"></div>`, { bar: { title: 'สร้างรอบ KPI', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('kCycleForm').addEventListener('submit', async e => {
      e.preventDefault();
      const restore = NT.busyButton(e.currentTarget.querySelector('button'), 'กำลังสร้าง...');
      try {
        const r = await NT.api('/kpi/cycle/save', Object.fromEntries(new FormData(e.currentTarget).entries()));
        NT.toast(r.existed ? 'มีรอบนี้อยู่แล้ว' : 'สร้างรอบแล้ว');
        await load(r.cycleId); paint();
      } catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  function renderKpiForm(kpi) {
    const k = kpi || {};
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">${k.kpiId ? 'แก้ไข KPI' : 'เพิ่ม KPI'}</h2><p class="m3-eyebrow">Corporate KPI — จะมอบให้ฝ่ายในก้อนถัดไป</p></section>
      <form id="kKpiForm" class="m3-section">
        <input type="hidden" name="cycleId" value="${esc(state.cycleId || '')}">
        <input type="hidden" name="kpiId" value="${esc(k.kpiId || '')}">
        <label class="m3-elabel">ชื่อ KPI</label><input class="m3-input" name="title" required value="${esc(k.title || '')}" placeholder="เช่น เพิ่มยอดขายรวม">
        <label class="m3-elabel">หมวด (ไม่บังคับ · เว้นว่างได้)</label>
        <select class="m3-select" name="perspective"><option value="">— ไม่ระบุ —</option>${state.perspectives.map(p => `<option value="${esc(p)}" ${k.perspective === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <label class="m3-elabel">น้ำหนัก (%)</label><input class="m3-input" type="number" name="weight" min="0" max="100" step="0.01" inputmode="decimal" value="${k.weight != null ? esc(String(k.weight)) : ''}" placeholder="เช่น 20">
        <div style="display:flex;gap:10px">
          <div style="flex:1"><label class="m3-elabel">เป้า (Target)</label><input class="m3-input" name="target" value="${esc(k.target || '')}" placeholder="เช่น 10"></div>
          <div style="flex:1"><label class="m3-elabel">หน่วย (Unit)</label><input class="m3-input" name="unit" value="${esc(k.unit || '')}" placeholder="เช่น %, ครั้ง, ล้านบาท"></div>
        </div>
        <label class="m3-elabel">กำหนดส่ง (Deadline)</label><input class="m3-input" type="date" name="deadline" value="${esc(k.deadline || '')}">
        <button type="submit" class="m3-btn" style="margin-top:16px">${mi('save')}บันทึก</button>
      </form><div style="height:30px"></div>`, { bar: { title: k.kpiId ? 'แก้ไข KPI' : 'เพิ่ม KPI', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('kKpiForm').addEventListener('submit', async e => {
      e.preventDefault();
      const restore = NT.busyButton(e.currentTarget.querySelector('button'), 'กำลังบันทึก...');
      try {
        await NT.api('/kpi/corporate/save', Object.fromEntries(new FormData(e.currentTarget).entries()));
        NT.toast('บันทึก KPI แล้ว');
        await load(state.cycleId); paint();
      } catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  async function deleteKpi(kpiId) {
    if (!await NT.confirmSheet({ title: 'ลบ KPI นี้?', desc: 'ลบออกจากรอบนี้ · กู้คืนไม่ได้', confirmLabel: 'ลบ', danger: true })) return;
    try { await NT.api('/kpi/corporate/delete', { kpiId }); NT.toast('ลบแล้ว'); await load(state.cycleId); paint(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }

  window.KPI = { renderHome };
})();
