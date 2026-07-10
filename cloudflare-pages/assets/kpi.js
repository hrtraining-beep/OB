/* ============================================================================
 * KPI System — frontend module (see PROJECT_KPI.md + HANDOFF_M3.md §0.1)
 * ก้อน 3a: Admin — รอบ (cycle) + Corporate KPI (สร้าง/แก้/ลบ + น้ำหนักรวม)
 * RULES: self-contained; talk to the app ONLY via window.NT; register window.KPI = { renderHome }.
 * ========================================================================== */
(function () {
  const NT = window.NT;
  if (!NT) { console.error('[KPI] bridge window.NT missing'); return; }

  const state = { cycleId: null, cycles: [], kpis: [], perspectives: [], departments: [], published: false, heads: [], deptUsers: {} };
  const esc = NT.escapeHtml, mi = NT.micon;

  // Themed loading block (sage spinner) — replaces the bare "sync icon" text so the KPI loading screen
  // matches the M3 theme. The <style> re-injects harmlessly on each render (same keyframe name).
  // Skeleton loader (sage shimmer) — matches the app's other list screens instead of a lone spinner.
  const skCss = '<style>@keyframes kpishim{0%{background-position:-280px 0}100%{background-position:280px 0}}.kpi-sk{background:linear-gradient(90deg,#e4ece8 25%,#f3f9f6 50%,#e4ece8 75%);background-size:560px 100%;animation:kpishim 1.15s ease-in-out infinite;border-radius:8px}</style>';
  const skBox = (w, h, mb) => `<div class="kpi-sk" style="width:${w};height:${h || '12px'};${mb ? 'margin-bottom:' + mb + ';' : ''}"></div>`;
  const skCard = () => `<div class="m3-card m3-card-pad" style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;gap:10px">${skBox('55%', '16px')}${skBox('44px', '20px')}</div>
    ${skBox('38%', '12px', '12px')}
    <div style="display:flex;gap:6px;margin-bottom:12px">${skBox('88px', '22px')}${skBox('70px', '22px')}</div>
    <div class="kpi-sk" style="height:42px;border-radius:12px"></div>
  </div>`;
  const loadingBody = () => `${skCss}
    <section class="m3-section" style="gap:8px">${skBox('46%', '22px', '6px')}${skBox('72%', '12px')}</section>
    <section class="m3-section">${skCard()}${skCard()}${skCard()}</section>`;
  // Aligned checkbox row: label text takes remaining width, checkbox pinned right + fixed size, so
  // long Thai names wrap cleanly without pushing the box out of a straight column.
  const checkRow = (cls, value, labelHtml, checked) => `
    <label class="m3-eitem" style="display:flex;align-items:center;gap:12px;cursor:pointer">
      <span style="flex:1;min-width:0">${labelHtml}</span>
      <input type="checkbox" class="${cls}" value="${esc(value)}" style="flex:none;width:20px;height:20px;margin:0" ${checked ? 'checked' : ''}>
    </label>`;

  async function load(cycleId) {
    const d = await NT.api('/kpi/overview', cycleId ? { cycleId } : {});
    state.cycles = d.cycles || [];
    state.kpis = d.kpis || [];
    state.cycleId = d.cycleId || null;
    state.perspectives = d.perspectives || [];
    state.departments = d.departments || [];
    state.heads = d.heads || [];
    state.deptUsers = d.deptUsers || {};
    const cur = state.cycles.find(c => c.cycleId === state.cycleId);
    state.published = Boolean(cur && cur.status && cur.status !== 'draft');
  }

  const cycleLabel = c => `ปี ${c.year} · ${c.period}`;
  const weightSum = () => state.kpis.reduce((s, k) => s + Number(k.weight || 0), 0);

  async function renderHome() {
    NT.render(NT.m3Shell('profile', loadingBody('กำลังโหลดข้อมูล KPI...'), { bar: { title: 'ระบบ KPI', back: true }, noNav: true }));
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
    const cur = state.cycles.find(c => c.cycleId === state.cycleId) || {};
    const timeframe = (cur.startDate || cur.dueDate)
      ? `ช่วงเวลา: ${cur.startDate ? esc(NT.formatThaiDate(cur.startDate)) : '—'} ถึง ${cur.dueDate ? esc(NT.formatThaiDate(cur.dueDate)) : '—'}`
      : 'ยังไม่กำหนดช่วงเวลาของรอบ';
    const allAssigned = state.kpis.length > 0 && state.kpis.every(k => (k.departments || []).length > 0);
    const canPublish = sum === 100 && allAssigned;
    const groups = state.perspectives.map(p => {
      const items = state.kpis.filter(k => k.perspective === p);
      if (!items.length) return '';
      return `<div class="m3-section-label" style="margin-top:12px">${esc(p)}</div>${items.map(kpiCard).join('')}`;
    }).join('');
    const noPersp = state.kpis.filter(k => !state.perspectives.includes(k.perspective));
    const noPerspHtml = noPersp.length ? `<div class="m3-section-label" style="margin-top:12px">ไม่ระบุหมวด</div>${noPersp.map(kpiCard).join('')}` : '';

    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:8px">
        <h2 class="m3-title">ระบบ KPI · Corporate</h2>
        <select class="m3-select" id="kCycleSel">${state.cycles.map(c => `<option value="${esc(c.cycleId)}" ${c.cycleId === state.cycleId ? 'selected' : ''}>${esc(cycleLabel(c))}${c.status !== 'draft' ? ' · ' + esc(c.status) : ''}</option>`).join('')}</select>
        <div style="display:flex;gap:8px">
          <button type="button" class="m3-btn m3-btn--ghost" id="kNewCycle" style="min-height:44px;flex:1">${mi('add')}สร้างรอบใหม่</button>
          <button type="button" class="m3-btn m3-btn--ghost" id="kManageCycle" style="min-height:44px;flex:1">${mi('settings')}จัดการรอบ</button>
        </div>
        <p class="m3-save-hint" style="text-align:left;margin:0">${timeframe}</p>
        <div class="m3-card m3-card-pad" style="display:flex;justify-content:space-between;align-items:center">
          <span class="m3-progress-cap">น้ำหนักรวมทุก KPI</span>
          <span class="m3-badge ${sum === 100 ? 'm3-badge--ok' : 'm3-badge--warn'}">${sum} / 100</span>
        </div>
        <p class="m3-save-hint" style="text-align:left">${state.published ? 'รอบนี้เผยแพร่แล้ว — KPI ถูกล็อก (แก้ไขต้องยกเลิกเผยแพร่ก่อน)' : 'น้ำหนักรวมต้องได้ 100% + มอบหมายทุก KPI ให้ฝ่าย ก่อนเผยแพร่ · เกณฑ์ให้คะแนน (grade) หัวหน้าฝ่ายตั้งตอนแจก'}</p>
        <button type="button" class="m3-btn m3-btn--ghost" id="kHeads" style="min-height:44px">${mi('manage_accounts')}ตั้งหัวหน้าฝ่าย (คนที่แจก KPI ให้พนักงาน)</button>
        <button type="button" class="m3-btn m3-btn--ghost" id="kDash" style="min-height:44px">${mi('insights')}ภาพรวมคะแนน KPI (Dashboard)</button>
      </section>
      <section class="m3-section">
        ${state.kpis.length ? (groups + noPerspHtml) : '<div class="m3-empty">ยังไม่มี KPI ในรอบนี้ · กด “เพิ่ม KPI” ด้านล่าง</div>'}
      </section>
      ${state.published ? '' : '<section class="m3-section"><button type="button" class="m3-btn m3-btn--tonal" id="kAddKpi">' + mi('add') + 'เพิ่ม KPI</button></section>'}
      ${state.published
        ? `<section class="m3-section"><div class="m3-card m3-card-pad" style="border-color:var(--m3-primary)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <span class="m3-staff-name" style="white-space:nowrap">${mi('verified')} เผยแพร่แล้ว</span>
              <button type="button" class="m3-btn m3-btn--ghost" id="kUnpublish" style="min-height:40px;width:auto;flex:none;white-space:nowrap">ยกเลิกเผยแพร่</button>
            </div>
            <p class="m3-save-hint" style="text-align:left;margin:8px 0 0">หัวหน้าแต่ละฝ่ายเห็น KPI ที่ฝ่ายตัวเองได้รับ → แตกเป็น KPI ย่อยให้พนักงาน</p></div></section>`
        : `<section class="m3-section">
            <button type="button" class="m3-btn" id="kPublish" ${canPublish ? '' : 'disabled'}>${mi('send')}เผยแพร่ให้ฝ่าย (Publish)</button>
            <p class="m3-save-hint" style="text-align:left">${canPublish ? 'พร้อมเผยแพร่ — หัวหน้าฝ่ายจะเห็น KPI ของฝ่ายตัวเอง' : 'ยังเผยแพร่ไม่ได้: ' + [sum !== 100 ? `น้ำหนักรวมต้องได้ 100 (ตอนนี้ ${sum})` : '', !allAssigned ? 'มี KPI ที่ยังไม่มอบหมายฝ่าย' : ''].filter(Boolean).join(' · ')}</p>
          </section>`}
      <div style="height:30px"></div>`, { bar: { title: 'ระบบ KPI', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => NT.goProfile() });

    document.getElementById('kNewCycle').addEventListener('click', renderCycleForm);
    document.getElementById('kManageCycle').addEventListener('click', () => renderCycleManage(cur));
    document.getElementById('kCycleSel').addEventListener('change', async e => { await load(e.target.value); paint(); });
    document.getElementById('kHeads').addEventListener('click', renderHeadsManage);
    document.getElementById('kDash').addEventListener('click', () => renderDashboard());
    const addBtn = document.getElementById('kAddKpi');
    if (addBtn) addBtn.addEventListener('click', () => renderKpiForm(null));
    const pubBtn = document.getElementById('kPublish');
    if (pubBtn) pubBtn.addEventListener('click', publishCycle);
    const unpubBtn = document.getElementById('kUnpublish');
    if (unpubBtn) unpubBtn.addEventListener('click', unpublishCycle);
    document.querySelectorAll('[data-kpi-assign]').forEach(b => b.addEventListener('click', () => renderAssignDept(state.kpis.find(k => k.kpiId === b.dataset.kpiAssign))));
    document.querySelectorAll('[data-kpi-edit]').forEach(b => b.addEventListener('click', () => renderKpiForm(state.kpis.find(k => k.kpiId === b.dataset.kpiEdit))));
    document.querySelectorAll('[data-kpi-del]').forEach(b => b.addEventListener('click', () => deleteKpi(b.dataset.kpiDel)));
  }

  async function publishCycle() {
    if (!await NT.confirmSheet({ title: 'เผยแพร่ให้ฝ่าย?', desc: 'KPI จะถูกล็อก และหัวหน้าฝ่ายจะเห็น KPI ที่ฝ่ายตัวเองได้รับ · แก้ไขต้องยกเลิกเผยแพร่ก่อน', confirmLabel: 'เผยแพร่' })) return;
    try { await NT.api('/kpi/publish', { cycleId: state.cycleId }); NT.toast('เผยแพร่แล้ว'); await load(state.cycleId); paint(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function unpublishCycle() {
    if (!await NT.confirmSheet({ title: 'ยกเลิกการเผยแพร่?', desc: 'กลับเป็นแบบร่างเพื่อแก้ไข', confirmLabel: 'ยกเลิกเผยแพร่', danger: true })) return;
    try { await NT.api('/kpi/unpublish', { cycleId: state.cycleId }); NT.toast('ยกเลิกเผยแพร่แล้ว'); await load(state.cycleId); paint(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }

  function kpiCard(k) {
    const depts = k.departments || [];
    const deptChips = depts.length
      ? depts.map(d => `<span class="m3-badge m3-badge--ok" style="margin:2px 4px 0 0">${esc(d.department)}${d.weightAllocated != null ? ' · ' + (Math.round(d.weightAllocated * 100) / 100) + '%' : ''}</span>`).join('')
      : '<span class="m3-badge m3-badge--warn">ยังไม่มอบหมายฝ่าย</span>';
    return `
      <div class="m3-card m3-card-pad" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div class="m3-staff-name">${esc(k.title)}</div>
            <div class="m3-staff-role">${k.target ? 'เป้า ' + esc(k.target) + (k.unit ? ' ' + esc(k.unit) : '') : 'ยังไม่ตั้งเป้า'}</div>
          </div>
          <span class="m3-badge">${Number(k.weight || 0)}%</span>
        </div>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:2px">${deptChips}</div>
        ${state.published ? '' : `<div class="m3-tpl-actions" style="margin-top:10px">
          <button type="button" class="m3-btn m3-btn--tonal" data-kpi-assign="${esc(k.kpiId)}">${mi('groups')}มอบหมายฝ่าย</button>
          <button type="button" class="m3-btn m3-btn--ghost" data-kpi-edit="${esc(k.kpiId)}">${mi('edit')}แก้ไข</button>
          <button type="button" class="m3-btn m3-btn--ghost" data-kpi-del="${esc(k.kpiId)}" style="color:var(--m3-error)">${mi('delete')}ลบ</button>
        </div>`}
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
        <div style="display:flex;gap:10px">
          <div style="flex:1"><label class="m3-elabel">วันเริ่ม (ไม่บังคับ)</label><input class="m3-input" type="date" name="startDate"></div>
          <div style="flex:1"><label class="m3-elabel">วันสิ้นสุด (ไม่บังคับ)</label><input class="m3-input" type="date" name="dueDate"></div>
        </div>
        <p class="m3-save-hint" style="text-align:left">ทุก KPI ในรอบนี้ใช้ช่วงเวลานี้ร่วมกัน · เว้นว่างได้ (ใช้แค่ H1/H2 เป็นกรอบ) · แก้ทีหลังได้</p>
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

  function renderCycleManage(cycle) {
    const c = cycle || {};
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">จัดการรอบ</h2><p class="m3-eyebrow">${esc(cycleLabel(c))}</p></section>
      <form id="kCycleManage" class="m3-section">
        <input type="hidden" name="year" value="${esc(String(c.year || ''))}">
        <input type="hidden" name="period" value="${esc(c.period || '')}">
        <label class="m3-elabel">วันเริ่ม</label><input class="m3-input" type="date" name="startDate" value="${esc(c.startDate || '')}">
        <label class="m3-elabel">วันสิ้นสุด</label><input class="m3-input" type="date" name="dueDate" value="${esc(c.dueDate || '')}">
        <button type="submit" class="m3-btn" style="margin-top:16px">${mi('save')}บันทึกช่วงเวลา</button>
      </form>
      <section class="m3-section" style="margin-top:18px;gap:6px">
        <div class="m3-section-label" style="color:var(--m3-error)">โซนอันตราย</div>
        <button type="button" class="m3-btn m3-btn--outline" id="kCycleDel" style="color:var(--m3-error);border-color:var(--m3-error)">${mi('delete')}ลบรอบนี้ (รวม KPI ทั้งหมดในรอบ)</button>
      </section>
      <div style="height:30px"></div>`, { bar: { title: 'จัดการรอบ', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('kCycleManage').addEventListener('submit', async e => {
      e.preventDefault();
      const restore = NT.busyButton(e.currentTarget.querySelector('button'), 'กำลังบันทึก...');
      try {
        const r = await NT.api('/kpi/cycle/save', Object.fromEntries(new FormData(e.currentTarget).entries()));
        NT.toast('บันทึกช่วงเวลาแล้ว');
        await load(r.cycleId || c.cycleId); paint();
      } catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
    document.getElementById('kCycleDel').addEventListener('click', async () => {
      if (!await NT.confirmSheet({ title: 'ลบรอบนี้?', desc: `ลบรอบ ${cycleLabel(c)} + KPI ทั้งหมด ${state.kpis.length} ข้อในรอบ · กู้คืนไม่ได้`, confirmLabel: 'ลบรอบ', danger: true })) return;
      try { await NT.api('/kpi/cycle/delete', { cycleId: c.cycleId }); NT.toast('ลบรอบแล้ว'); state.cycleId = null; await load(null); paint(); }
      catch (err) { NT.toast(err.message, 'error'); }
    });
  }

  function renderAssignDept(kpi) {
    const k = kpi || {};
    const assigned = new Set((k.departments || []).map(d => d.department));
    if (!state.departments.length) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section" style="gap:4px"><h2 class="m3-title">มอบหมายฝ่าย</h2></section><section class="m3-section"><div class="m3-empty">ยังไม่มีฝ่ายในระบบ · เพิ่มพนักงาน (พร้อมแผนก) ใน Master Data ก่อน</div></section>`, { bar: { title: 'มอบหมายฝ่าย', back: true }, noNav: true }));
      NT.wireM3Nav({ back: () => paint() });
      return;
    }
    const rows = state.departments.map(d => checkRow('kAsgDept', d, esc(d), assigned.has(d))).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">มอบหมายฝ่าย</h2><p class="m3-eyebrow">${esc(k.title || '')} · น้ำหนัก ${Number(k.weight || 0)}%</p></section>
      <section class="m3-section"><div class="m3-card m3-card-pad">${rows}
        <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid var(--m3-outline-variant)"><span class="m3-progress-cap">น้ำหนักต่อฝ่าย (auto)</span><strong id="kAsgPer" style="color:var(--m3-primary)">—</strong></div>
      </div><p class="m3-save-hint" style="text-align:left">น้ำหนักของ KPI จะถูกหารเท่ากันให้ทุกฝ่ายที่เลือก</p></section>
      <section class="m3-section"><button type="button" class="m3-btn" id="kAsgSave">${mi('save')}บันทึกการมอบหมาย</button></section>
      <div style="height:30px"></div>`, { bar: { title: 'มอบหมายฝ่าย', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => paint() });
    const recalc = () => {
      const n = document.querySelectorAll('.kAsgDept:checked').length;
      document.getElementById('kAsgPer').textContent = n ? `${Math.round((Number(k.weight || 0) / n) * 100) / 100}% × ${n} ฝ่าย` : 'ยังไม่เลือกฝ่าย';
    };
    document.querySelectorAll('.kAsgDept').forEach(c => c.addEventListener('change', recalc));
    recalc();
    document.getElementById('kAsgSave').addEventListener('click', async e => {
      const departments = [...document.querySelectorAll('.kAsgDept:checked')].map(c => c.value);
      const restore = NT.busyButton(e.currentTarget, 'กำลังบันทึก...');
      try { await NT.api('/kpi/corporate/assign', { kpiId: k.kpiId, departments }); NT.toast('มอบหมายฝ่ายแล้ว'); await load(state.cycleId); paint(); }
      catch (err) { restore(); NT.toast(err.message, 'error'); }
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
          <div style="flex:1"><label class="m3-elabel">หน่วยวัด</label><input class="m3-input" name="unit" list="kpiUnits" value="${esc(k.unit || '')}" placeholder="เลือกหรือพิมพ์"></div>
        </div>
        <datalist id="kpiUnits">${['%', 'ชิ้น', 'ครั้ง', 'บาท', 'ล้านบาท', 'วัน', 'คน', 'คะแนน'].map(u => `<option value="${u}">`).join('')}</datalist>
        <p class="m3-save-hint" style="text-align:left;margin:6px 0 0">ช่วงเวลาส่งใช้ตาม “รอบ” (${esc(state.cycleId ? (state.cycles.find(c => c.cycleId === state.cycleId) ? cycleLabel(state.cycles.find(c => c.cycleId === state.cycleId)) : '') : '')}) ไม่ต้องตั้งต่อ KPI</p>
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

  // ---- HR: ตั้งหัวหน้าฝ่าย (department → user) ----
  function renderHeadsManage() {
    const headBy = {};
    state.heads.forEach(h => { headBy[h.department] = h.userId; });
    const rows = state.departments.map(dep => {
      const users = state.deptUsers[dep] || [];
      const cur = headBy[dep] || '';
      const opts = ['<option value="">— ยังไม่กำหนด —</option>'].concat(
        users.map(u => `<option value="${esc(u.userId)}" ${u.userId === cur ? 'selected' : ''}>${esc(u.name)}</option>`)
      ).join('');
      const note = users.length ? '' : '<p class="m3-save-hint" style="text-align:left;margin:2px 0 0">ยังไม่มีผู้ใช้ที่ลงทะเบียนในฝ่ายนี้ (ต้องลงทะเบียนก่อนถึงตั้งเป็นหัวหน้าได้)</p>';
      return `<div class="m3-card m3-card-pad" style="margin-bottom:10px">
        <div class="m3-elabel">${esc(dep)}</div>
        <select class="m3-select kHeadSel" data-dep="${esc(dep)}" ${users.length ? '' : 'disabled'}>${opts}</select>${note}
      </div>`;
    }).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">ตั้งหัวหน้าฝ่าย</h2><p class="m3-eyebrow">หัวหน้าฝ่ายจะเห็น KPI ที่ฝ่ายได้รับ → ตั้งเกณฑ์ให้คะแนน + แจกให้พนักงาน · 1 คน/ฝ่าย</p></section>
      <section class="m3-section">${state.departments.length ? rows : '<div class="m3-empty">ยังไม่มีฝ่ายในระบบ · เพิ่มพนักงาน (พร้อมแผนก) ใน Master Data ก่อน</div>'}</section>
      <div style="height:30px"></div>`, { bar: { title: 'ตั้งหัวหน้าฝ่าย', back: true }, noNav: true }));
    NT.wireM3Nav({ back: () => paint() });
    document.querySelectorAll('.kHeadSel').forEach(sel => sel.addEventListener('change', async e => {
      const department = e.target.dataset.dep, userId = e.target.value;
      try { await NT.api('/kpi/heads/save', { department, userId }); NT.toast(userId ? 'บันทึกหัวหน้าฝ่ายแล้ว' : 'ล้างหัวหน้าฝ่ายแล้ว'); await load(state.cycleId); }
      catch (err) { NT.toast(err.message, 'error'); }
    }));
  }

  // ============================================================================
  // หัวหน้าฝ่าย (ก้อน 3c): เห็น KPI ที่ฝ่ายได้รับ → ตั้งเกณฑ์ grade 1-5 → แจกให้พนักงาน
  // ============================================================================
  const dstate = { data: null };
  const bar = t => ({ bar: { title: t, back: true }, noNav: true });

  async function renderDeptHome() {
    NT.render(NT.m3Shell('profile', loadingBody('กำลังโหลด KPI ฝ่ายของคุณ...'), bar('KPI ฝ่ายของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    try { dstate.data = await NT.api('/kpi/dept/overview', {}); paintDept(); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} โหลดไม่สำเร็จ: ${esc(e.message || '')}</div></section>`, bar('KPI ฝ่ายของฉัน')));
      NT.wireM3Nav({ back: () => NT.goPortal() });
    }
  }
  async function refreshDept() { dstate.data = await NT.api('/kpi/dept/overview', {}); }

  function paintDept() {
    const d = dstate.data || {};
    if (!d.managedDepartments || !d.managedDepartments.length) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section" style="gap:4px"><h2 class="m3-title">KPI ฝ่ายของฉัน</h2></section><section class="m3-section"><div class="m3-empty">คุณยังไม่ได้รับแต่งตั้งเป็นหัวหน้าฝ่าย · หากคิดว่าผิดพลาด กรุณาติดต่อ HR</div></section>`, bar('KPI ฝ่ายของฉัน')));
      NT.wireM3Nav({ back: () => NT.goPortal() });
      return;
    }
    const cyc = d.cycle;
    const cycLine = cyc ? `รอบปัจจุบัน: ปี ${cyc.year} · ${cyc.period}` : 'ยังไม่มีรอบ KPI ที่เผยแพร่ในตอนนี้';
    const body = d.departments.map(dep => {
      const cards = (dep.kpis || []).length ? dep.kpis.map(k => deptKpiCard(dep, k)).join('') : '<div class="m3-empty">ยังไม่มี KPI ที่มอบหมายให้ฝ่ายนี้ในรอบนี้</div>';
      const label = d.departments.length > 1 ? `<div class="m3-section-label" style="margin-top:12px">ฝ่าย ${esc(dep.department)}</div>` : '';
      const personal = dep.personalSubs || [];
      const personalCards = personal.length ? personal.map(s => subCard(dep.department, s)).join('') : '<div class="m3-empty" style="padding:12px">ยังไม่มี KPI เฉพาะบุคคล</div>';
      const personalBlock = `<div class="m3-section-label" style="margin-top:16px">KPI เฉพาะบุคคล (ไม่ผูกองค์กร)</div>${personalCards}<button type="button" class="m3-btn m3-btn--ghost" data-psub="${esc(dep.department)}" style="margin-top:6px">${mi('add')}เพิ่ม KPI เฉพาะบุคคล</button>`;
      return label + cards + personalBlock;
    }).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">KPI ฝ่ายของฉัน</h2><p class="m3-eyebrow">${esc(cycLine)}</p></section>
      <section class="m3-section">${body}</section>
      <div style="height:30px"></div>`, bar('KPI ฝ่ายของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    document.querySelectorAll('[data-sub]').forEach(b => b.addEventListener('click', () => renderSubList(b.dataset.dep, b.dataset.sub)));
    document.querySelectorAll('[data-psub]').forEach(b => b.addEventListener('click', () => renderSubForm(b.dataset.psub, null, null)));
    wireSubCards(() => paintDept());
  }

  const findDep = depName => (dstate.data.departments || []).find(d => d.department === depName);
  const allSubs = () => {
    const out = [];
    (dstate.data.departments || []).forEach(dep => {
      (dep.personalSubs || []).forEach(s => out.push(s));
      (dep.kpis || []).forEach(k => (k.subs || []).forEach(s => out.push(s)));
    });
    return out;
  };

  // Weighted-average achievement (0-100%) over APPROVED sub-KPIs (final_grade/5 × weight);
  // blank weight counts as 1. Only approved subs contribute — matches "free weight + normalize".
  function subsScore(subs) {
    let wsum = 0, num = 0, approved = 0;
    (subs || []).forEach(s => {
      if (s.finalGrade == null) return;
      const w = (s.weight == null || s.weight === '') ? 1 : (Number(s.weight) || 0);
      const eff = w > 0 ? w : 1;
      num += (Number(s.finalGrade) / 5) * eff;
      wsum += eff;
      approved += 1;
    });
    return { pct: wsum ? Math.round((num / wsum) * 100) : null, approved };
  }

  function deptKpiCard(dep, k) {
    const subs = k.subs || [];
    const assignedCnt = subs.filter(s => s.userId).length;
    const sc = subsScore(subs);
    return `<div class="m3-card m3-card-pad" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="flex:1;min-width:0"><div class="m3-staff-name">${esc(k.title)}</div>
        <div class="m3-staff-role">${k.target ? 'เป้า ' + esc(k.target) + (k.unit ? ' ' + esc(k.unit) : '') : 'ยังไม่ตั้งเป้า'}</div></div>
        <span class="m3-badge">${k.weightAllocated != null ? (Math.round(k.weightAllocated * 100) / 100) + '%' : ''}</span>
      </div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">
        <span class="m3-badge ${subs.length ? 'm3-badge--ok' : 'm3-badge--warn'}">KPI ย่อย ${subs.length} ข้อ</span>
        ${assignedCnt ? `<span class="m3-badge m3-badge--ok">แจกแล้ว ${assignedCnt} คน</span>` : ''}
        ${sc.pct != null ? `<span class="m3-badge" style="background:var(--m3-primary);color:#fff">คะแนนฝ่าย ${sc.pct}% · อนุมัติ ${sc.approved}/${subs.length}</span>` : ''}
      </div>
      <div class="m3-tpl-actions" style="margin-top:10px">
        <button type="button" class="m3-btn m3-btn--tonal" data-sub="${esc(k.kpiId)}" data-dep="${esc(dep.department)}">${mi('account_tree')}แตก KPI ย่อย</button>
      </div>
    </div>`;
  }

  // Card for one sub-KPI (used both under an org KPI and in the personal-KPI list).
  function subCard(depName, s) {
    const critDone = s.criteria && s.criteria.every(v => String(v || '').trim());
    const meta = [s.userName ? '👤 ' + esc(s.userName) : 'ยังไม่ระบุผู้รับผิดชอบ',
      s.target ? 'เป้า ' + esc(s.target) + (s.unit ? ' ' + esc(s.unit) : '') : '',
      s.weight != null ? 'น้ำหนัก ' + (Math.round(s.weight * 100) / 100) + '%' : ''].filter(Boolean).join(' · ');
    const gradeBadge = s.finalGrade != null
      ? `<span class="m3-badge" style="background:var(--m3-primary);color:#fff">อนุมัติแล้ว · เกรด ${s.finalGrade} (${Math.round(s.finalGrade / 5 * 100)}%)</span>`
      : (s.selfGrade != null
        ? `<span class="m3-badge m3-badge--warn">พนักงานให้ ${s.selfGrade} · รออนุมัติ</span>`
        : '<span class="m3-badge">ยังไม่กรอกผล</span>');
    const canApprove = s.userId && (s.selfGrade != null || s.finalGrade != null);
    return `<div class="m3-card m3-card-pad" style="margin-bottom:8px">
      <div class="m3-staff-name">${esc(s.title)}</div>
      <div class="m3-staff-role">${meta}</div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px"><span class="m3-badge ${critDone ? 'm3-badge--ok' : 'm3-badge--warn'}">${critDone ? 'ตั้งเกณฑ์แล้ว' : 'ยังไม่ตั้งเกณฑ์'}</span>${gradeBadge}</div>
      <div class="m3-tpl-actions" style="margin-top:8px">
        ${canApprove ? `<button type="button" class="m3-btn m3-btn--tonal" data-subapprove="${esc(s.subId)}" data-dep="${esc(depName)}">${mi('verified')}อนุมัติเกรด</button>` : ''}
        <button type="button" class="m3-btn m3-btn--ghost" data-subedit="${esc(s.subId)}" data-dep="${esc(depName)}">${mi('edit')}แก้ไข</button>
        <button type="button" class="m3-btn m3-btn--ghost" data-subdel="${esc(s.subId)}" style="color:var(--m3-error)">${mi('delete')}ลบ</button>
      </div>
    </div>`;
  }

  function wireSubCards(back) {
    document.querySelectorAll('[data-subapprove]').forEach(b => b.addEventListener('click', () => {
      const s = allSubs().find(x => x.subId === b.dataset.subapprove);
      if (s) renderApprove(b.dataset.dep, s);
    }));
    document.querySelectorAll('[data-subedit]').forEach(b => b.addEventListener('click', () => {
      const s = allSubs().find(x => x.subId === b.dataset.subedit);
      renderSubForm(b.dataset.dep, s ? s.parentKpiId : null, s);
    }));
    document.querySelectorAll('[data-subdel]').forEach(b => b.addEventListener('click', async () => {
      if (!await NT.confirmSheet({ title: 'ลบ KPI ย่อยนี้?', desc: 'กู้คืนไม่ได้', confirmLabel: 'ลบ', danger: true })) return;
      try { await NT.api('/kpi/sub/delete', { subId: b.dataset.subdel }); NT.toast('ลบแล้ว'); await refreshDept(); back(); }
      catch (e) { NT.toast(e.message, 'error'); }
    }));
  }

  // List sub-KPIs under one org KPI + add button.
  function renderSubList(depName, kpiId) {
    const dep = findDep(depName); if (!dep) { paintDept(); return; }
    const k = (dep.kpis || []).find(x => x.kpiId === kpiId); if (!k) { paintDept(); return; }
    const subs = k.subs || [];
    const cards = subs.length ? subs.map(s => subCard(depName, s)).join('') : '<div class="m3-empty">ยังไม่มี KPI ย่อยใต้ข้อนี้ · กด “เพิ่ม KPI ย่อย”</div>';
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">แตก KPI ย่อย</h2><p class="m3-eyebrow">ภายใต้: ${esc(k.title)} · ฝ่าย ${esc(depName)} · น้ำหนักฝ่าย ${k.weightAllocated != null ? (Math.round(k.weightAllocated * 100) / 100) : 0}%</p></section>
      <section class="m3-section">${cards}</section>
      <section class="m3-section"><button type="button" class="m3-btn" id="kSubAdd">${mi('add')}เพิ่ม KPI ย่อย</button>
      <p class="m3-save-hint" style="text-align:left">แตกงานของ KPI องค์กรนี้เป็นชิ้นเล็กต่อคน · คะแนน KPI ย่อยจะเฉลี่ยกลับเป็นคะแนนของ KPI องค์กรนี้</p></section>
      <div style="height:30px"></div>`, bar('แตก KPI ย่อย')));
    NT.wireM3Nav({ back: () => paintDept() });
    document.getElementById('kSubAdd').addEventListener('click', () => renderSubForm(depName, kpiId, null));
    wireSubCards(() => renderSubList(depName, kpiId));
  }

  // Create/edit one sub-KPI. parentKpiId null = personal KPI (not linked to corporate).
  function renderSubForm(depName, parentKpiId, sub) {
    const dep = findDep(depName); if (!dep) { paintDept(); return; }
    const s = sub || {};
    const cands = dep.candidates || [];
    const cr = s.criteria || [null, null, null, null, null];
    const back = () => parentKpiId ? renderSubList(depName, parentKpiId) : paintDept();
    const gradeMeta = [
      { g: 5, hint: 'สูงกว่าเป้าหมายในระดับดีเยี่ยม' },
      { g: 4, hint: 'สูงกว่าเป้าหมายเล็กน้อย' },
      { g: 3, hint: 'บรรลุเป้าหมาย (มาตรฐาน)' },
      { g: 2, hint: 'ต่ำกว่าเป้าหมายเล็กน้อย' },
      { g: 1, hint: 'ต่ำกว่าเป้าหมายมาก / ไม่ได้ปฏิบัติ' }
    ];
    const gfields = gradeMeta.map(m => `
      <label class="m3-elabel">Grade ${m.g} — ${m.hint}</label>
      <textarea class="m3-textarea kSubCrit" data-g="${m.g}" rows="2" placeholder="เกณฑ์ของ grade ${m.g}">${esc(cr[m.g - 1] || '')}</textarea>`).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">${s.subId ? 'แก้ไข' : 'เพิ่ม'} KPI ย่อย</h2><p class="m3-eyebrow">${parentKpiId ? 'ใต้ KPI องค์กร' : 'KPI เฉพาะบุคคล'} · ฝ่าย ${esc(depName)}</p></section>
      <form id="kSubForm" class="m3-section">
        <label class="m3-elabel">ชื่อ KPI ย่อย</label><input class="m3-input" name="title" required value="${esc(s.title || '')}" placeholder="เช่น ปิดงบรายเดือนตรงเวลา">
        <label class="m3-elabel">ผู้รับผิดชอบ</label>
        <select class="m3-select" name="userId"><option value="">— ยังไม่ระบุ —</option>${cands.map(u => `<option value="${esc(u.userId)}" ${s.userId === u.userId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>
        <div style="display:flex;gap:10px">
          <div style="flex:1"><label class="m3-elabel">เป้า</label><input class="m3-input" name="target" value="${esc(s.target || '')}" placeholder="เช่น 5"></div>
          <div style="flex:1"><label class="m3-elabel">หน่วย</label><input class="m3-input" name="unit" list="kSubUnits" value="${esc(s.unit || '')}"></div>
        </div>
        <datalist id="kSubUnits">${['%', 'ชิ้น', 'ครั้ง', 'บาท', 'วัน', 'คน', 'คะแนน'].map(u => `<option value="${u}">`).join('')}</datalist>
        <label class="m3-elabel">น้ำหนัก (%) — ไม่บังคับ</label><input class="m3-input" type="number" name="weight" min="0" max="100" step="0.01" inputmode="decimal" value="${s.weight != null ? esc(String(s.weight)) : ''}" placeholder="เว้นว่างได้">
        <div class="m3-section-label" style="margin-top:14px">เกณฑ์ให้คะแนน (grade 1-5)</div>
        ${gfields}
        <p class="m3-save-hint" style="text-align:left">พนักงานจะเห็นเกณฑ์นี้ตอนกรอกผล · ครบ 5 ระดับหรือไม่ก็ได้ในขั้นนี้</p>
        <button type="submit" class="m3-btn" style="margin-top:12px">${mi('save')}บันทึก</button>
      </form><div style="height:30px"></div>`, bar(s.subId ? 'แก้ไข KPI ย่อย' : 'เพิ่ม KPI ย่อย')));
    NT.wireM3Nav({ back });
    document.getElementById('kSubForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.currentTarget;
      const grades = [1, 2, 3, 4, 5].map(g => { const el = f.querySelector(`.kSubCrit[data-g="${g}"]`); return el ? el.value : ''; });
      const fd = Object.fromEntries(new FormData(f).entries());
      const payload = { subId: s.subId || '', parentKpiId: parentKpiId || '', department: depName, title: fd.title || '', userId: fd.userId || '', target: fd.target || '', unit: fd.unit || '', weight: fd.weight || '', grades };
      const restore = NT.busyButton(f.querySelector('button'), 'กำลังบันทึก...');
      try { await NT.api('/kpi/sub/save', payload); NT.toast('บันทึก KPI ย่อยแล้ว'); await refreshDept(); back(); }
      catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  function renderCriteriaForm(dep, k) {
    const cr = k.criteria || [null, null, null, null, null];
    const gradeMeta = [
      { g: 5, hint: 'สูงกว่าเป้าหมายในระดับดีเยี่ยม' },
      { g: 4, hint: 'สูงกว่าเป้าหมายเล็กน้อย' },
      { g: 3, hint: 'บรรลุเป้าหมาย (มาตรฐาน)' },
      { g: 2, hint: 'ต่ำกว่าเป้าหมายเล็กน้อย' },
      { g: 1, hint: 'ต่ำกว่าเป้าหมายมาก / ไม่ได้ปฏิบัติ' }
    ];
    const fields = gradeMeta.map(m => `
      <label class="m3-elabel">Grade ${m.g} — ${m.hint}</label>
      <textarea class="m3-textarea kCrit" data-g="${m.g}" rows="2" placeholder="อธิบายเกณฑ์ของ grade ${m.g} เช่น ยอดขาย ≥ ...">${esc(cr[m.g - 1] || '')}</textarea>`).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">ตั้งเกณฑ์ให้คะแนน</h2><p class="m3-eyebrow">${esc(k.title)} · ฝ่าย ${esc(dep.department)}</p></section>
      <section class="m3-section">${fields}
        <p class="m3-save-hint" style="text-align:left">อธิบายว่าแต่ละ grade หมายถึงผลงานระดับไหน (ใส่ตัวเลข/ข้อความได้) · พนักงานจะเห็นเกณฑ์นี้ตอนกรอกผล · ต้องครบทั้ง 5 ระดับ</p>
        <button type="button" class="m3-btn" id="kCritSave" style="margin-top:8px">${mi('save')}บันทึกเกณฑ์</button>
      </section><div style="height:30px"></div>`, bar('ตั้งเกณฑ์ให้คะแนน')));
    NT.wireM3Nav({ back: () => paintDept() });
    document.getElementById('kCritSave').addEventListener('click', async e => {
      const grades = [1, 2, 3, 4, 5].map(g => { const el = document.querySelector(`.kCrit[data-g="${g}"]`); return el ? el.value : ''; });
      const restore = NT.busyButton(e.currentTarget, 'กำลังบันทึก...');
      try { await NT.api('/kpi/dept/criteria', { kpiId: k.kpiId, department: dep.department, grades }); NT.toast('บันทึกเกณฑ์แล้ว'); await refreshDept(); paintDept(); }
      catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  function renderDistribute(dep, k) {
    const assigned = new Set(k.assignedUserIds || []);
    const cands = dep.candidates || [];
    const rows = cands.length ? cands.map(u => checkRow('kDist', u.userId, esc(u.name), assigned.has(u.userId))).join('') : '<div class="m3-empty">ยังไม่มีพนักงานที่ลงทะเบียนในฝ่ายนี้</div>';
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">แจกให้พนักงาน</h2><p class="m3-eyebrow">${esc(k.title)} · ฝ่าย ${esc(dep.department)} · น้ำหนัก ${k.weightAllocated != null ? (Math.round(k.weightAllocated * 100) / 100) : 0}%</p></section>
      <section class="m3-section"><div class="m3-card m3-card-pad">${rows}</div>
      <p class="m3-save-hint" style="text-align:left">เลือกพนักงานที่รับผิดชอบ KPI นี้ · ทุกคนที่เลือกถือน้ำหนักของฝ่ายเท่ากัน</p></section>
      <section class="m3-section"><button type="button" class="m3-btn" id="kDistSave" ${cands.length ? '' : 'disabled'}>${mi('save')}บันทึกการแจก</button></section>
      <div style="height:30px"></div>`, bar('แจกให้พนักงาน')));
    NT.wireM3Nav({ back: () => paintDept() });
    document.getElementById('kDistSave').addEventListener('click', async e => {
      const userIds = [...document.querySelectorAll('.kDist:checked')].map(c => c.value);
      const restore = NT.busyButton(e.currentTarget, 'กำลังบันทึก...');
      try { await NT.api('/kpi/dept/assign', { kpiId: k.kpiId, department: dep.department, userIds }); NT.toast('แจกให้พนักงานแล้ว'); await refreshDept(); paintDept(); }
      catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  // ---- chunk 3b: เส้นทางรายเดือน (progress chart) ----
  const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function monthsOf(sub) {
    const n = sub.cyclePeriod === 'Full' ? 12 : 6;
    const start = sub.cycleStart ? Number(String(sub.cycleStart).slice(5, 7)) : null;
    return Array.from({ length: n }, (_, i) => ({ no: i + 1, label: (start >= 1 && start <= 12) ? TH_MON[(start - 1 + i) % 12] : ('ด.' + (i + 1)) }));
  }
  const progMap = sub => { const m = {}; (sub.progress || []).forEach(p => { m[p.monthNo] = p.value; }); return m; };
  function progressChart(sub) {
    const months = monthsOf(sub), pm = progMap(sub);
    const parse = v => { if (v == null || v === '') return null; const n = Number(v); return isNaN(n) ? null : n; };
    const nums = months.map(m => parse(pm[m.no])).filter(v => v != null);
    if (!nums.length) return '<div class="m3-save-hint" style="text-align:center;padding:12px 0">ยังไม่มีข้อมูลรายเดือน — อัปเดตด้านล่างเพื่อเริ่มเห็นเส้นทาง 📈</div>';
    const tnum = parse(sub.target);
    const max = Math.max(...nums, tnum || 0, 1);
    const cols = months.map(m => {
      const raw = pm[m.no], n = parse(raw), h = n != null ? Math.max(6, Math.round(n / max * 100)) : 0;
      const has = raw != null && raw !== '';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0">
        <div style="font-size:10px;color:var(--m3-primary);font-weight:700;height:13px;line-height:1">${has ? esc(String(raw)) : ''}</div>
        <div style="width:100%;max-width:20px;height:64px;display:flex;align-items:flex-end;background:#eef4f1;border-radius:5px;overflow:hidden">
          <div style="width:100%;height:${h}%;background:linear-gradient(180deg,#5a7d6c,#426454);border-radius:5px 5px 0 0"></div>
        </div>
        <div style="font-size:9px;color:var(--m3-muted);line-height:1">${esc(m.label)}</div>
      </div>`;
    }).join('');
    const tline = tnum != null ? `<div class="m3-save-hint" style="text-align:center;margin:6px 0 0">🎯 เป้า ${esc(String(sub.target))}${sub.unit ? ' ' + esc(sub.unit) : ''}</div>` : '';
    return `<div style="display:flex;gap:3px;align-items:flex-end;padding:4px 2px">${cols}</div>${tline}`;
  }

  // Per-month detail list (value + note) — so the head reviews all months, not just the latest.
  function monthlyDetailRows(sub) {
    const months = monthsOf(sub), pm = progMap(sub);
    const noteOf = mno => { const p = (sub.progress || []).find(x => x.monthNo === mno); return p ? (p.note || '') : ''; };
    const withData = months.filter(m => (pm[m.no] != null && pm[m.no] !== '') || noteOf(m.no));
    if (!withData.length) return '';
    return withData.map(m => `<div class="m3-att-row" style="align-items:flex-start"><span class="t" style="flex:none;width:54px">${esc(m.label)}</span><div style="flex:1;text-align:right;min-width:0"><strong>${pm[m.no] != null && pm[m.no] !== '' ? esc(String(pm[m.no])) + (sub.unit ? ' ' + esc(sub.unit) : '') : '—'}</strong>${noteOf(m.no) ? `<div class="m3-save-hint" style="text-align:right;margin:0">📝 ${esc(noteOf(m.no))}</div>` : ''}</div></div>`).join('');
  }

  // Suggested grade from final result vs target (achievement ratio) — a helper for the head, not binding.
  // Aligns with grade meaning: 3 = meets target · 5 = well above · 1 = well below.
  function suggestGrade(actualRaw, targetRaw) {
    if (actualRaw == null || actualRaw === '') return null;
    const a = Number(actualRaw), t = Number(targetRaw);
    if (isNaN(a) || isNaN(t) || t === 0) return null;
    const r = a / t;
    const grade = r >= 1.2 ? 5 : r >= 1.05 ? 4 : r >= 0.95 ? 3 : r >= 0.8 ? 2 : 1;
    return { grade, pct: Math.round(r * 100) };
  }

  // Shared: show the 5 grade criteria (read-only) + a grade picker.
  const gradeCriteriaRows = cr => [5, 4, 3, 2, 1].map(g =>
    `<div class="m3-att-row" style="align-items:flex-start"><span class="t" style="flex:none;width:64px">Grade ${g}</span><span style="flex:1;text-align:right">${esc((cr || [])[g - 1] || '—')}</span></div>`).join('');
  const gradeSelect = (id, cur) => `<select class="m3-select" id="${id}"><option value="">— เลือกเกรด 1-5 —</option>${[5, 4, 3, 2, 1].map(g => `<option value="${g}" ${String(cur) === String(g) ? 'selected' : ''}>เกรด ${g}</option>`).join('')}</select>`;

  // ---- หัวหน้าฝ่าย: อนุมัติเกรดสุดท้ายของ KPI ย่อย ----
  function renderApprove(depName, sub) {
    const back = () => sub.parentKpiId ? renderSubList(depName, sub.parentKpiId) : paintDept();
    const sug = suggestGrade(sub.actualResult, sub.target);
    const cur = sub.finalGrade != null ? sub.finalGrade : (sub.selfGrade != null ? sub.selfGrade : (sug ? sug.grade : ''));
    const cyc = (dstate.data && dstate.data.cycle) || {};
    const subC = { ...sub, cyclePeriod: cyc.period, cycleStart: cyc.startDate };
    const hasProg = (sub.progress || []).length > 0;
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">อนุมัติเกรด</h2><p class="m3-eyebrow">${esc(sub.title)} · 👤 ${esc(sub.userName || '')}</p></section>
      <section class="m3-section">
        <div class="m3-card m3-card-pad">
          <div class="m3-att-row"><span class="t">ผลล่าสุดที่พนักงานกรอก</span><strong>${esc(sub.actualResult || '—')}${sub.actualResult && sub.unit ? ' ' + esc(sub.unit) : ''}</strong></div>
          <div class="m3-att-row"><span class="t">เกรดที่พนักงานให้ตัวเอง</span><strong>${sub.selfGrade != null ? sub.selfGrade : '—'}</strong></div>
        </div>
        ${hasProg ? `<div class="m3-section-label" style="margin-top:12px">📈 เส้นทางรายเดือน (รีวิวครบทุกเดือน)</div><div class="m3-card m3-card-pad">${progressChart(subC)}<div style="margin-top:10px;border-top:1px solid var(--m3-outline-variant);padding-top:8px">${monthlyDetailRows(subC)}</div></div>` : ''}
        <div class="m3-section-label" style="margin-top:12px">เกณฑ์ให้คะแนน</div>
        <div class="m3-card m3-card-pad">${gradeCriteriaRows(sub.criteria)}</div>
        ${sug ? `<div class="m3-card m3-card-pad" style="border-left:4px solid var(--m3-primary);margin-top:10px">
          <div class="m3-staff-name">💡 เกรดแนะนำ: ${sug.grade}</div>
          <div class="m3-list-sub" style="margin-top:2px">ทำได้ ${esc(String(sub.actualResult))} จากเป้า ${esc(String(sub.target))}${sub.unit ? ' ' + esc(sub.unit) : ''} = <strong>${sug.pct}% ของเป้า</strong></div>
          <div class="m3-save-hint" style="text-align:left;margin-top:4px">เกณฑ์แนะนำ: ≥120%=5 · ≥105%=4 · ~เป้า (95%+)=3 · 80%+=2 · ต่ำกว่านั้น=1 · <strong>หัวหน้าปรับได้ตามดุลยพินิจ</strong></div>
        </div>` : ''}
        <label class="m3-elabel" style="margin-top:12px">เกรดสุดท้าย (หัวหน้าอนุมัติ)</label>
        ${gradeSelect('kApproveGrade', cur)}
        <p class="m3-save-hint" style="text-align:left;margin-top:4px">ความหมาย: 5=สูงกว่าเป้ามาก · 4=สูงกว่าเป้า · 3=บรรลุเป้า · 2=ต่ำกว่าเป้า · 1=ต่ำกว่ามาก</p>
        <button type="button" class="m3-btn" id="kApproveSave" style="margin-top:12px">${mi('verified')}อนุมัติเกรด</button>
        ${sub.approvedAt ? `<button type="button" class="m3-btn m3-btn--ghost" id="kUnapprove" style="margin-top:8px">ยกเลิกอนุมัติ (ให้พนักงานแก้ได้)</button>` : ''}
        <p class="m3-save-hint" style="text-align:left;color:var(--m3-error)">⚠️ อนุมัติ = <strong>ปิดรอบของคนนี้</strong> — ควรทำตอน<strong>จบรอบ H1 หลังพนักงานกรอกครบทุกเดือน</strong> · อนุมัติแล้วพนักงานแก้ผล/เดือนไม่ได้ (เผลอกด → "ยกเลิกอนุมัติ" ให้เขาทำต่อ)</p>
        <p class="m3-save-hint" style="text-align:left">คะแนน = เกรด÷5 × น้ำหนัก → เฉลี่ยเป็นคะแนนฝ่าย → ขึ้น Dashboard/corporate</p>
      </section><div style="height:30px"></div>`, bar('อนุมัติเกรด')));
    NT.wireM3Nav({ back });
    document.getElementById('kApproveSave').addEventListener('click', async e => {
      const finalGrade = document.getElementById('kApproveGrade').value;
      if (!finalGrade) { NT.toast('เลือกเกรดก่อน', 'error'); return; }
      const restore = NT.busyButton(e.currentTarget, 'กำลังอนุมัติ...');
      try { await NT.api('/kpi/sub/approve', { subId: sub.subId, finalGrade }); NT.toast('อนุมัติเกรดแล้ว'); await refreshDept(); back(); }
      catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
    const unBtn = document.getElementById('kUnapprove');
    if (unBtn) unBtn.addEventListener('click', async () => {
      if (!await NT.confirmSheet({ title: 'ยกเลิกอนุมัติ?', desc: 'พนักงานจะกลับมาแก้ผล+เกรดตัวเองได้', confirmLabel: 'ยกเลิกอนุมัติ', danger: true })) return;
      try { await NT.api('/kpi/sub/approve', { subId: sub.subId, finalGrade: '' }); NT.toast('ยกเลิกอนุมัติแล้ว'); await refreshDept(); back(); }
      catch (err) { NT.toast(err.message, 'error'); }
    });
  }

  // ============================================================================
  // พนักงาน (ก้อน 4 chunk 2): กรอกผล KPI ย่อยที่ถูกแจกให้ + ให้เกรดตัวเอง
  // ============================================================================
  const mystate = { subs: [] };
  async function renderMyKpi() {
    NT.render(NT.m3Shell('profile', loadingBody('กำลังโหลด KPI ของคุณ...'), bar('KPI ของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    try { mystate.subs = (await NT.api('/kpi/my', {})).subs || []; paintMyKpi(); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} โหลดไม่สำเร็จ: ${esc(e.message || '')}</div></section>`, bar('KPI ของฉัน')));
      NT.wireM3Nav({ back: () => NT.goPortal() });
    }
  }
  function paintMyKpi() {
    const subs = mystate.subs || [];
    const cards = subs.length ? subs.map(myCard).join('') : '<div class="m3-empty">ยังไม่มี KPI ที่ถูกแจกให้คุณ</div>';
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">KPI ของฉัน</h2><p class="m3-eyebrow">กรอกผลที่ทำได้ + ให้เกรดตัวเอง → หัวหน้าจะอนุมัติเกรดสุดท้าย</p></section>
      <section class="m3-section">${cards}</section><div style="height:30px"></div>`, bar('KPI ของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    document.querySelectorAll('[data-myfill]').forEach(b => b.addEventListener('click', () => {
      const s = subs.find(x => x.subId === b.dataset.myfill);
      if (s) renderMyFill(s);
    }));
  }
  function myCard(s) {
    const locked = Boolean(s.approvedAt);
    const badge = locked
      ? `<span class="m3-badge" style="background:var(--m3-primary);color:#fff">อนุมัติแล้ว · เกรด ${s.finalGrade} (${Math.round(s.finalGrade / 5 * 100)}%)</span>`
      : (s.selfGrade != null ? `<span class="m3-badge m3-badge--warn">ส่งแล้ว (ให้ตัวเอง ${s.selfGrade}) · รอหัวหน้าอนุมัติ</span>` : '<span class="m3-badge m3-badge--warn">ยังไม่กรอกผล</span>');
    const meta = [s.parentTitle ? 'ใต้: ' + esc(s.parentTitle) : 'KPI เฉพาะบุคคล', s.target ? 'เป้า ' + esc(s.target) + (s.unit ? ' ' + esc(s.unit) : '') : ''].filter(Boolean).join(' · ');
    return `<div class="m3-card m3-card-pad" style="margin-bottom:10px">
      <div class="m3-staff-name">${esc(s.title)}</div>
      <div class="m3-staff-role">${meta}</div>
      <div style="margin-top:6px">${badge}</div>
      <div class="m3-tpl-actions" style="margin-top:10px">
        <button type="button" class="m3-btn ${locked ? 'm3-btn--ghost' : 'm3-btn--tonal'}" data-myfill="${esc(s.subId)}">${mi(locked ? 'visibility' : 'edit_note')}${locked ? 'ดูผล/เส้นทาง' : (s.selfGrade != null ? 'แก้ไข/อัปเดต' : 'กรอกผล')}</button>
      </div>
    </div>`;
  }
  function renderMyFill(s) {
    const months = monthsOf(s), pm = progMap(s);
    const withData = months.filter(m => pm[m.no] != null && pm[m.no] !== '').map(m => m.no);
    const defMonth = withData.length ? Math.max(...withData) : 1;
    const noteOf = mno => { const p = (s.progress || []).find(x => x.monthNo === mno); return p ? (p.note || '') : ''; };
    const locked = Boolean(s.approvedAt);
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">KPI ของฉัน</h2><p class="m3-eyebrow">${esc(s.title)}${s.target ? ' · เป้า ' + esc(s.target) + (s.unit ? ' ' + esc(s.unit) : '') : ''}</p></section>
      <section class="m3-section">
        <div class="m3-section-label">📈 เส้นทางรายเดือน</div>
        <div class="m3-card m3-card-pad">${progressChart(s)}${monthlyDetailRows(s) ? `<div style="margin-top:10px;border-top:1px solid var(--m3-outline-variant);padding-top:8px">${monthlyDetailRows(s)}</div>` : ''}</div>
        ${locked ? '<p class="m3-save-hint" style="text-align:left">หัวหน้าอนุมัติแล้ว — แก้ไขไม่ได้</p>' : `
        <form id="kProgForm" class="m3-card m3-card-pad" style="margin-top:8px">
          <div class="m3-elabel">อัปเดตผลของเดือน (ยอดสะสม)</div>
          <div style="display:flex;gap:8px">
            <select class="m3-select" name="monthNo" style="flex:none;width:110px">${months.map(m => `<option value="${m.no}" ${m.no === defMonth ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
            <input class="m3-input" name="value" style="flex:1" value="${esc(pm[defMonth] != null ? String(pm[defMonth]) : '')}" placeholder="ยอด${s.unit ? ' (' + esc(s.unit) + ')' : ''}">
          </div>
          <input class="m3-input" name="note" style="margin-top:8px" value="${esc(noteOf(defMonth))}" placeholder="โน้ต (ไม่บังคับ) เช่น อุปสรรค/ไฮไลต์">
          <button type="submit" class="m3-btn m3-btn--tonal" style="margin-top:10px">${mi('add_chart')}บันทึกเดือนนี้</button>
          <p class="m3-save-hint" style="text-align:left">เลือกเดือน → กรอกยอดสะสม ณ เดือนนั้น · เลือกเดือนที่มีข้อมูล ช่องจะโชว์ค่าเดิมให้แก้</p>
        </form>`}
      </section>
      <section class="m3-section">
        <div class="m3-section-label">เกณฑ์ให้คะแนน</div>
        <div class="m3-card m3-card-pad">${gradeCriteriaRows(s.criteria)}</div>
        ${locked ? `<div class="m3-card m3-card-pad" style="margin-top:8px"><div class="m3-att-row"><span class="t">เกรดสุดท้าย (อนุมัติแล้ว)</span><strong style="color:var(--m3-primary)">${s.finalGrade} (${Math.round(s.finalGrade / 5 * 100)}%)</strong></div></div>` : `
        <form id="kMyForm" class="m3-section" style="margin-top:8px">
          <label class="m3-elabel">เกรดที่คิดว่าตัวเองได้ (1-5)</label>
          ${gradeSelect('kMyGrade', s.selfGrade != null ? s.selfGrade : '')}
          <button type="submit" class="m3-btn" style="margin-top:14px">${mi('send')}ส่งเกรดตัวเอง</button>
          <p class="m3-save-hint" style="text-align:left">แก้ไขได้จนกว่าหัวหน้าจะอนุมัติ · หัวหน้าเห็นเส้นทาง+เกรดของคุณแล้วอนุมัติเกรดสุดท้าย</p>
        </form>`}
      </section><div style="height:30px"></div>`, bar('KPI ของฉัน')));
    NT.wireM3Nav({ back: () => paintMyKpi() });
    const progForm = document.getElementById('kProgForm');
    if (progForm) {
      const monthSel = progForm.querySelector('[name=monthNo]');
      monthSel.addEventListener('change', () => {
        const mno = Number(monthSel.value);
        progForm.querySelector('[name=value]').value = pm[mno] != null ? String(pm[mno]) : '';
        progForm.querySelector('[name=note]').value = noteOf(mno);
      });
      progForm.addEventListener('submit', async e => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.currentTarget).entries());
        const restore = NT.busyButton(e.currentTarget.querySelector('button'), 'กำลังบันทึก...');
        try {
          await NT.api('/kpi/my/progress', { subId: s.subId, monthNo: fd.monthNo, value: fd.value || '', note: fd.note || '' });
          NT.toast('บันทึกเดือนแล้ว');
          mystate.subs = (await NT.api('/kpi/my', {})).subs || [];
          renderMyFill(mystate.subs.find(x => x.subId === s.subId) || s);
        } catch (err) { restore(); NT.toast(err.message, 'error'); }
      });
    }
    const myForm = document.getElementById('kMyForm');
    if (myForm) myForm.addEventListener('submit', async e => {
      e.preventDefault();
      const selfGrade = document.getElementById('kMyGrade').value;
      const restore = NT.busyButton(e.currentTarget.querySelector('button'), 'กำลังส่ง...');
      try {
        await NT.api('/kpi/my/submit', { subId: s.subId, selfGrade });
        NT.toast('ส่งเกรดแล้ว');
        mystate.subs = (await NT.api('/kpi/my', {})).subs || [];
        paintMyKpi();
      } catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  // ---- HR/Exec: ภาพรวมคะแนน KPI ไหลรวมขึ้นองค์กร ----
  async function renderDashboard() {
    NT.render(NT.m3Shell('profile', loadingBody(), bar('ภาพรวมคะแนน KPI')));
    NT.wireM3Nav({ back: () => paint() });
    let d;
    try { d = await NT.api('/kpi/dashboard', state.cycleId ? { cycleId: state.cycleId } : {}); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} โหลดไม่สำเร็จ: ${esc(e.message || '')}</div></section>`, bar('ภาพรวมคะแนน KPI')));
      NT.wireM3Nav({ back: () => paint() }); return;
    }
    const rows = d.kpis || [];
    const scored = rows.filter(r => r.pct != null);
    const cyc = d.cycle;
    const totalCard = `<div class="m3-card m3-card-pad" style="text-align:center;border-color:var(--m3-primary)">
      <div class="m3-eyebrow">คะแนนรวมองค์กร (เฉพาะน้ำหนักที่อนุมัติแล้ว)</div>
      <div style="font-size:34px;font-weight:800;color:var(--m3-primary);margin-top:4px">${d.total || 0} <span style="font-size:15px;color:var(--m3-muted)">/ ${d.scoredWeight || 0}</span></div>
      <div class="m3-save-hint" style="margin-top:2px">อนุมัติแล้ว ${scored.length}/${rows.length} KPI · เต็มทั้งรอบ = 100 แต้ม</div>
    </div>`;
    // gap/insight cards (แปลตัวเลขเป็น "สิ่งที่ควรพัฒนา" ตาม north star)
    const insights = dashInsights(rows);
    const insightHtml = insights.length ? `<div class="m3-section-label" style="margin-top:14px">🎯 สิ่งที่ควรโฟกัส</div>` + insights.map(ins => {
      const color = ins.tone === 'warn' ? '#ef7b2f' : (ins.tone === 'ok' ? 'var(--m3-primary)' : '#3b6fb0');
      return `<div class="m3-card m3-card-pad" style="border-left:4px solid ${color};margin-bottom:10px">
        <div style="display:flex;gap:10px;align-items:flex-start">
          <span style="color:${color};flex:none">${mi(ins.icon)}</span>
          <div style="flex:1;min-width:0"><div class="m3-staff-name">${esc(ins.title)}</div>
          <div class="m3-list-sub" style="margin-top:2px">${esc(ins.detail)}</div>
          <div style="margin-top:6px;font-size:12.5px;color:var(--m3-primary)">→ ควรทำ: ${esc(ins.action)}</div></div>
        </div></div>`;
    }).join('') : '';
    const kpiRow = k => {
      const barHtml = k.pct != null ? `<div class="m3-progress" style="margin-top:6px"><div class="m3-progress-bar" style="width:${k.pct}%"></div></div>` : '';
      const chips = (k.depScores || []).length
        ? k.depScores.map(ds => `<span class="m3-badge" style="margin:4px 4px 0 0">${esc(ds.department)} ${ds.pct}%</span>`).join('')
        : '<span class="m3-save-hint">ยังไม่มีผลอนุมัติ</span>';
      return `<div class="m3-card m3-card-pad" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="flex:1;min-width:0"><div class="m3-staff-name">${esc(k.title)}</div><div class="m3-staff-role">น้ำหนัก ${k.weight} แต้ม${k.pct != null ? ' · ได้ ' + k.contribution + '/' + k.weight + ' แต้ม' : ''}</div></div>
          <span class="m3-badge ${k.pct != null ? 'm3-badge--ok' : ''}">${k.pct != null ? k.pct + '%' : '—'}</span>
        </div>
        ${barHtml}
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:2px">${chips}</div>
      </div>`;
    };
    const persp = [...new Set(rows.map(r => r.perspective))];
    const body = rows.length ? persp.map(p => {
      const items = rows.filter(r => r.perspective === p);
      const label = `<div class="m3-section-label" style="margin-top:12px">${p ? esc(p) : 'ไม่ระบุหมวด'}</div>`;
      return label + items.map(kpiRow).join('');
    }).join('') : '<div class="m3-empty">ยังไม่มี KPI ในรอบนี้</div>';
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">ภาพรวมคะแนน KPI</h2><p class="m3-eyebrow">${cyc ? 'ปี ' + cyc.year + ' · ' + cyc.period : 'ยังไม่มีรอบ'}</p></section>
      <section class="m3-section">${totalCard}${insightHtml}</section>
      <section class="m3-section"><div class="m3-section-label">คะแนนราย KPI</div>${body}</section>
      <div style="height:30px"></div>`, bar('ภาพรวมคะแนน KPI')));
    NT.wireM3Nav({ back: () => paint() });
  }

  // แปลคะแนน dashboard เป็น gap/insight (KPI ที่อ่อนสุด, ฝ่ายที่ฉุด, ที่ยังไม่อนุมัติ).
  function dashInsights(rows) {
    const out = [];
    const scored = rows.filter(r => r.pct != null);
    if (scored.length) {
      const s = [...scored].sort((a, b) => a.pct - b.pct);
      const low = s[0];
      out.push({ tone: 'warn', icon: 'trending_down', title: `KPI ที่ทำได้ต่ำสุด: ${low.title}`, detail: `ทั้งองค์กรทำได้ ${low.pct}% (น้ำหนัก ${low.weight} แต้ม)`, action: 'โฟกัสพัฒนา KPI ข้อนี้ก่อน — ดูว่าฝ่ายไหนฉุดในการ์ดด้านล่าง' });
      if (s.length >= 2) { const high = s[s.length - 1]; if (high.pct - low.pct >= 10) out.push({ tone: 'ok', icon: 'trending_up', title: `KPI ที่ดีสุด: ${high.title}`, detail: `ทำได้ ${high.pct}%`, action: 'ถอดบทเรียนความสำเร็จไปใช้กับ KPI ที่อ่อน' }); }
    }
    const dep = {};
    scored.forEach(r => (r.depScores || []).forEach(ds => { (dep[ds.department] = dep[ds.department] || []).push(ds.pct); }));
    const depAvg = Object.keys(dep).map(k => ({ department: k, avg: Math.round(dep[k].reduce((a, b) => a + b, 0) / dep[k].length) })).sort((a, b) => a.avg - b.avg);
    if (depAvg.length >= 2 && (depAvg[depAvg.length - 1].avg - depAvg[0].avg) >= 10) {
      const lo = depAvg[0], hi = depAvg[depAvg.length - 1];
      out.push({ tone: 'info', icon: 'compare_arrows', title: 'ช่องว่างระหว่างฝ่าย', detail: `${hi.department} เฉลี่ย ${hi.avg}% นำ ${lo.department} ${lo.avg}%`, action: `ถ่ายทอด best practice จาก ${hi.department} → ${lo.department}` });
    }
    const pending = rows.length - scored.length;
    if (pending > 0) out.push({ tone: 'warn', icon: 'pending', title: `ยังไม่อนุมัติ ${pending} KPI`, detail: 'คะแนนรวมยังไม่สมบูรณ์จนกว่าจะอนุมัติครบ', action: 'ตามหัวหน้าฝ่ายให้อนุมัติเกรดพนักงานให้ครบ' });
    return out;
  }

  window.KPI = { renderHome, renderDeptHome, renderMyKpi, renderDashboard };
})();
