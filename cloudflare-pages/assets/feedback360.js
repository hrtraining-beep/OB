/* ============================================================================
 * 360° Feedback System — frontend module (see PROJECT_360.md + HANDOFF_M3.md)
 * RULES: self-contained; talk to the app ONLY via window.NT; register window.FB360 = { renderHome }.
 * Phase A: HR admin home — cycles + question bank (CMS: view / edit / toggle / add per axis).
 * ========================================================================== */
(function () {
  const NT = window.NT;
  if (!NT) { console.error('[FB360] bridge window.NT missing'); return; }
  const esc = NT.escapeHtml, mi = NT.micon;
  const state = { cycles: [], questionCounts: [], relations: [] };
  const bar = t => ({ bar: { title: t, back: true }, noNav: true });

  async function renderHome() {
    NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('sync')} กำลังโหลด 360° Feedback...</div></section>`, bar('360° Feedback')));
    NT.wireM3Nav({ back: () => NT.goProfile() });
    try {
      const d = await NT.api('/360/overview', {});
      state.cycles = d.cycles || [];
      state.questionCounts = d.questionCounts || [];
      state.relations = d.relations || [];
      paint();
    } catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} โหลดไม่สำเร็จ: ${esc(e.message || '')}</div></section>`, bar('360° Feedback')));
      NT.wireM3Nav({ back: () => NT.goProfile() });
    }
  }

  const cycleLabel = c => `ปี ${c.year} · ${c.period}`;

  function paint() {
    const cycleCards = state.cycles.length
      ? state.cycles.map(c => `<div class="m3-card m3-card-pad" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div style="min-width:0"><div class="m3-staff-name">${esc(cycleLabel(c))}</div><div class="m3-staff-role">${c.status !== 'draft' ? esc(c.status) : 'ร่าง'}${c.startDate ? ' · เริ่ม ' + esc(NT.formatThaiDate(c.startDate)) : ''}</div></div>
            <button type="button" class="m3-btn m3-btn--ghost" data-fc-del="${esc(c.cycleId)}" style="min-height:38px;width:auto;flex:none;color:var(--m3-error)">${mi('delete')}</button>
          </div>
          <button type="button" class="m3-btn m3-btn--tonal" data-fc-pair="${esc(c.cycleId)}" style="margin-top:8px">${mi('hub')}จัดการคู่ประเมิน (Pairing)</button>
        </div>`).join('')
      : '<div class="m3-empty">ยังไม่มีรอบ 360 · สร้างรอบแรกด้านล่าง</div>';
    const qCards = state.questionCounts.map(q => `<div class="m3-card m3-card-pad" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div style="flex:1;min-width:0"><div class="m3-staff-name">${esc(q.label)}</div><div class="m3-staff-role">${q.active} ข้อใช้งาน · ทั้งหมด ${q.total}</div></div>
        <button type="button" class="m3-btn m3-btn--tonal" data-q-view="${esc(q.relation)}" style="min-height:40px;width:auto;flex:none">${mi('quiz')}ดู/แก้</button>
      </div>`).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">360° Feedback</h2><p class="m3-eyebrow">แบบประเมินรอบทิศ · ตั้งรอบ + คลังคำถาม (แก้ได้)</p></section>
      <section class="m3-section">
        <h3 class="m3-section-label">รอบประเมิน 360</h3>${cycleCards}
        <button type="button" class="m3-btn m3-btn--ghost" id="fcNew" style="margin-top:6px">${mi('add')}สร้างรอบ 360</button>
      </section>
      <section class="m3-section">
        <h3 class="m3-section-label">คลังคำถาม (Question Bank)</h3>
        <p class="m3-save-hint" style="text-align:left;margin:0 0 8px">4 แกน · แก้/เพิ่ม/ปิดใช้คำถามได้เลย (ไม่ต้องแตะโค้ด)</p>${qCards}
      </section>
      <div style="height:30px"></div>`, bar('360° Feedback')));
    NT.wireM3Nav({ back: () => NT.goProfile() });
    document.getElementById('fcNew').addEventListener('click', renderCycleForm);
    document.querySelectorAll('[data-q-view]').forEach(b => b.addEventListener('click', () => renderQuestions(b.dataset.qView)));
    document.querySelectorAll('[data-fc-del]').forEach(b => b.addEventListener('click', () => deleteCycle(b.dataset.fcDel)));
    document.querySelectorAll('[data-fc-pair]').forEach(b => b.addEventListener('click', () => renderPairing(b.dataset.fcPair)));
  }

  // ============================================================================
  // Phase B — pairing preview / confirm
  // ============================================================================
  const pstate = { cycleId: null, data: null };
  async function loadPairing() { pstate.data = await NT.api('/360/pairing/list', { cycleId: pstate.cycleId }); }
  async function renderPairing(cycleId) {
    pstate.cycleId = cycleId;
    NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('sync')} กำลังโหลดการจับคู่...</div></section>`, bar('จัดการคู่ประเมิน')));
    NT.wireM3Nav({ back: () => paint() });
    try { await loadPairing(); paintPairing(); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('จัดการคู่ประเมิน')));
      NT.wireM3Nav({ back: () => paint() });
    }
  }

  // Searchable person picker (type-to-filter + tap-to-pick) over the whole Master Data pool.
  function comboBox(key, selId, selName) {
    return `<div class="fcb" data-cb="${esc(key)}" style="position:relative;flex:1;min-width:0">
      <input type="hidden" class="fcb-id" value="${esc(selId || '')}">
      <input type="text" class="m3-input fcb-input" placeholder="พิมพ์ชื่อค้นหา / แตะเพื่อเลือก" autocomplete="off" value="${esc(selName || '')}">
      <div class="fcb-list" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);z-index:30;background:#fff;border:1px solid var(--m3-outline-variant);border-radius:10px;max-height:230px;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.15)"></div>
    </div>`;
  }
  function wireCombos() {
    const people = (pstate.data && pstate.data.people) || [];
    document.querySelectorAll('.fcb').forEach(cb => {
      const input = cb.querySelector('.fcb-input'), hid = cb.querySelector('.fcb-id'), list = cb.querySelector('.fcb-list');
      const render = () => {
        const q = input.value.trim().toLowerCase();
        const matches = people.filter(p => !q || p.name.toLowerCase().includes(q) || (p.department || '').toLowerCase().includes(q)).slice(0, 40);
        list.innerHTML = matches.length
          ? matches.map(p => `<div class="fcb-opt" data-id="${esc(p.id)}" style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--m3-outline-variant)"><div style="font-size:14px">${esc(p.name)}</div><div style="font-size:11px;color:var(--m3-muted)">${esc(p.department || '')}${p.level ? ' · L' + p.level + '/R' + p.rank : ''}</div></div>`).join('')
          : '<div style="padding:10px 12px;color:var(--m3-muted);font-size:13px">ไม่พบชื่อ</div>';
        list.style.display = 'block';
      };
      input.addEventListener('focus', render);
      input.addEventListener('input', () => { hid.value = ''; render(); });
      list.addEventListener('mousedown', e => {
        const opt = e.target.closest('.fcb-opt'); if (!opt) return;
        e.preventDefault();
        hid.value = opt.dataset.id;
        const p = people.find(x => x.id === opt.dataset.id);
        input.value = p ? p.name : '';
        list.style.display = 'none';
      });
      input.addEventListener('blur', () => setTimeout(() => { list.style.display = 'none'; }, 150));
    });
  }
  function comboId(key) { const cb = document.querySelector(`.fcb[data-cb="${key}"]`); return cb ? cb.querySelector('.fcb-id').value : ''; }

  function paintPairing() {
    const d = pstate.data;
    const sent = d.cycle && d.cycle.status !== 'draft';
    const c = d.cycle || {};
    if (!d.total) {
      NT.render(NT.m3Shell('profile', `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">จัดการคู่ประเมิน</h2><p class="m3-eyebrow">${c.year ? 'ปี ' + c.year + ' · ' + c.period : ''}</p></section>
        <section class="m3-section"><div class="m3-empty">ยังไม่ได้จับคู่ · กดปุ่มด้านล่างให้ระบบสร้างคู่อัตโนมัติ (SELF/ORG ทุกคน · PEER/BOSS ตามกฎ) แล้วรีวิวก่อนส่ง</div>
        <button type="button" class="m3-btn" id="pGen" style="margin-top:10px">${mi('auto_awesome')}สร้างคู่อัตโนมัติ</button></section>`, bar('จัดการคู่ประเมิน')));
      NT.wireM3Nav({ back: () => paint() });
      document.getElementById('pGen').addEventListener('click', generatePairing);
      return;
    }
    const cnt = d.counts || {};
    const summary = `<div class="m3-card m3-card-pad"><div style="display:flex;flex-wrap:wrap;gap:6px">
      <span class="m3-badge m3-badge--ok">SELF ${cnt.self || 0}</span>
      <span class="m3-badge m3-badge--ok">PEER ${cnt.peer || 0}</span>
      <span class="m3-badge m3-badge--ok">BOSS ${cnt.boss || 0}</span>
      <span class="m3-badge m3-badge--ok">ORG ${cnt.org || 0}</span>
      <span class="m3-badge">รวม ${d.total}</span></div>
      <p class="m3-save-hint" style="text-align:left;margin:6px 0 0">SELF/ORG จับให้ทุกคนอัตโนมัติ · รีวิว PEER/BOSS ด้านล่างก่อนส่ง</p></div>`;
    // no-boss warnings
    const noBoss = d.noBoss || [];
    const noBossHtml = noBoss.length ? `<div class="m3-section-label" style="margin-top:14px;color:var(--m3-error)">⚠️ หาหัวหน้าไม่เจอ (${noBoss.length}) — เลือกให้เอง</div>` +
      noBoss.map(p => `<div class="m3-card m3-card-pad" style="margin-bottom:8px">
        <div class="m3-staff-name">${esc(p.name)}</div><div class="m3-staff-role">${esc(p.department || '')}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          ${comboBox('boss:' + p.id, '', '')}
          <button type="button" class="m3-btn m3-btn--tonal pBossSet" data-sub="${esc(p.id)}" style="width:auto;flex:none">${mi('check')}</button>
        </div></div>`).join('') : '';
    // boss list
    const bossRows = d.bossRows || [];
    const bossHtml = `<div class="m3-section-label" style="margin-top:14px">หัวหน้า (BOSS) · ลูกน้อง → หัวหน้า (${bossRows.length})</div>` +
      (bossRows.length ? bossRows.map(b => `<div class="m3-card m3-card-pad" style="margin-bottom:8px">
        <div class="m3-staff-role">${esc(b.subordinateName)} → <strong>${esc(b.bossName || '—')}</strong></div>
        <div style="display:flex;gap:8px;margin-top:6px">
          ${comboBox('boss:' + b.subordinateId, b.bossId, b.bossName)}
          <button type="button" class="m3-btn m3-btn--ghost pBossSet" data-sub="${esc(b.subordinateId)}" style="width:auto;flex:none">${mi('sync')}</button>
        </div></div>`).join('') : '<div class="m3-empty">—</div>');
    // peer groups
    const peerGroups = d.peerGroups || [];
    const peerHtml = `<div class="m3-section-label" style="margin-top:14px">เพื่อนร่วมงาน (PEER) · ใครประเมินใคร (${peerGroups.length} คนถูกประเมิน)</div>` +
      (peerGroups.length ? peerGroups.map(g => `<div class="m3-card m3-card-pad" style="margin-bottom:8px">
        <div class="m3-staff-name">ผู้ถูกประเมิน: ${esc(g.subjectName)}</div>
        <div style="margin-top:6px">${g.evaluators.map(ev => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0"><span>${esc(ev.evaluatorName)}${ev.cross ? ' <span class="m3-badge m3-badge--warn">ข้ามแผนก</span>' : ''}</span><button type="button" class="m3-btn m3-btn--ghost pRemove" data-aid="${esc(ev.assignmentId)}" style="width:auto;flex:none;min-height:32px;color:var(--m3-error)">${mi('close')}</button></div>`).join('')}</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          ${comboBox('peer:' + g.subjectId, '', '')}
          <button type="button" class="m3-btn m3-btn--tonal pPeerAdd" data-subj="${esc(g.subjectId)}" style="width:auto;flex:none">${mi('add')}</button>
        </div></div>`).join('') : '<div class="m3-empty">—</div>');

    const footer = sent
      ? `<div class="m3-card m3-card-pad" style="border-color:var(--m3-primary);text-align:center"><span class="m3-staff-name">${mi('verified')} ส่งแล้ว (สถานะ ${esc(c.status)})</span><p class="m3-save-hint">พนักงานเริ่มตอบได้ · แก้คู่ไม่ได้แล้ว</p></div>`
      : `<button type="button" class="m3-btn" id="pConfirm">${mi('send')}ยืนยัน + ส่งให้พนักงาน</button>
         <button type="button" class="m3-btn m3-btn--ghost" id="pRegen" style="margin-top:8px">${mi('refresh')}สร้างคู่ใหม่ (ล้างของเดิม)</button>
         <p class="m3-save-hint" style="text-align:left">ยืนยันแล้ว = ส่งให้พนักงานตอบ · แก้คู่ไม่ได้อีก (ตรวจให้ครบก่อน)</p>`;

    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">จัดการคู่ประเมิน</h2><p class="m3-eyebrow">${c.year ? 'ปี ' + c.year + ' · ' + c.period : ''} · รีวิวก่อนส่ง</p></section>
      <section class="m3-section">${summary}${noBossHtml}${bossHtml}${peerHtml}</section>
      <section class="m3-section">${footer}</section>
      <div style="height:30px"></div>`, bar('จัดการคู่ประเมิน')));
    NT.wireM3Nav({ back: () => paint() });
    if (!sent) {
      wireCombos();
      document.querySelectorAll('.pBossSet').forEach(b => b.addEventListener('click', () => setBoss(b.dataset.sub)));
      document.querySelectorAll('.pPeerAdd').forEach(b => b.addEventListener('click', () => addPeer(b.dataset.subj)));
      document.querySelectorAll('.pRemove').forEach(b => b.addEventListener('click', () => removeAssignment(b.dataset.aid)));
      const cf = document.getElementById('pConfirm'); if (cf) cf.addEventListener('click', confirmPairing);
      const rg = document.getElementById('pRegen'); if (rg) rg.addEventListener('click', generatePairing);
    }
  }

  async function generatePairing() {
    if (pstate.data && pstate.data.total && !await NT.confirmSheet({ title: 'สร้างคู่ใหม่?', desc: 'ล้างการจับคู่เดิมทั้งหมดแล้วสร้างใหม่', confirmLabel: 'สร้างใหม่', danger: true })) return;
    try { const r = await NT.api('/360/pairing/generate', { cycleId: pstate.cycleId }); NT.toast(`สร้างคู่แล้ว ${r.count} รายการ`); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function setBoss(sub) {
    const bossId = comboId('boss:' + sub);
    if (!bossId) { NT.toast('พิมพ์/เลือกหัวหน้าก่อน', 'error'); return; }
    try { await NT.api('/360/pairing/setboss', { cycleId: pstate.cycleId, subordinateId: sub, bossId }); NT.toast('ตั้งหัวหน้าแล้ว'); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function addPeer(subj) {
    const peerId = comboId('peer:' + subj);
    if (!peerId) { NT.toast('พิมพ์/เลือกผู้ประเมินก่อน', 'error'); return; }
    try { await NT.api('/360/pairing/addpeer', { cycleId: pstate.cycleId, subjectId: subj, peerId }); NT.toast('เพิ่มผู้ประเมินแล้ว'); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function removeAssignment(aid) {
    try { await NT.api('/360/pairing/remove', { assignmentId: aid }); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function confirmPairing() {
    if (!await NT.confirmSheet({ title: 'ยืนยัน + ส่ง?', desc: 'ส่งให้พนักงานเริ่มตอบ · หลังส่งแก้คู่ไม่ได้', confirmLabel: 'ส่ง' })) return;
    try { const r = await NT.api('/360/pairing/confirm', { cycleId: pstate.cycleId }); NT.toast(`ส่งแล้ว ${r.count} รายการ`); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }

  function renderCycleForm() {
    const now = state.cycles[0] ? state.cycles[0].year : 2569;
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">สร้างรอบ 360</h2><p class="m3-eyebrow">2 รอบ/ปี (H1/H2)</p></section>
      <form id="fcForm" class="m3-section">
        <label class="m3-elabel">ปี (พ.ศ.)</label><input class="m3-input" type="number" name="year" value="${now}" inputmode="numeric" required>
        <label class="m3-elabel">รอบ</label><select class="m3-select" name="period">${['H1', 'H2'].map(p => `<option value="${p}">${p}</option>`).join('')}</select>
        <div style="display:flex;gap:10px">
          <div style="flex:1"><label class="m3-elabel">วันเริ่ม (ไม่บังคับ)</label><input class="m3-input" type="date" name="startDate"></div>
          <div style="flex:1"><label class="m3-elabel">วันสิ้นสุด (ไม่บังคับ)</label><input class="m3-input" type="date" name="dueDate"></div>
        </div>
        <button type="submit" class="m3-btn" style="margin-top:16px">${mi('save')}สร้างรอบ</button>
      </form><div style="height:30px"></div>`, bar('สร้างรอบ 360')));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('fcForm').addEventListener('submit', async e => {
      e.preventDefault();
      const restore = NT.busyButton(e.currentTarget.querySelector('button'), 'กำลังสร้าง...');
      try {
        const r = await NT.api('/360/cycle/save', Object.fromEntries(new FormData(e.currentTarget).entries()));
        NT.toast(r.existed ? 'มีรอบนี้อยู่แล้ว (อัปเดตวันที่)' : 'สร้างรอบแล้ว');
        await renderHome();
      } catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  async function deleteCycle(cycleId) {
    if (!await NT.confirmSheet({ title: 'ลบรอบนี้?', desc: 'ลบรอบ 360 นี้ · กู้คืนไม่ได้', confirmLabel: 'ลบ', danger: true })) return;
    try { await NT.api('/360/cycle/delete', { cycleId }); NT.toast('ลบรอบแล้ว'); await renderHome(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }

  // ---- Question bank CMS (per axis) ----
  const qstate = { relation: null, questions: [], themes: {} };
  async function renderQuestions(relation) {
    qstate.relation = relation;
    NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('sync')} กำลังโหลดคำถาม...</div></section>`, bar('คลังคำถาม')));
    NT.wireM3Nav({ back: () => paint() });
    try {
      const d = await NT.api('/360/questions', { relation });
      qstate.questions = d.questions || [];
      qstate.themes = d.themes || {};
      paintQuestions();
    } catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('คลังคำถาม')));
      NT.wireM3Nav({ back: () => paint() });
    }
  }

  function paintQuestions() {
    const rel = state.relations.find(r => r.key === qstate.relation);
    const relLabel = rel ? rel.label : qstate.relation;
    const themesOrder = [];
    qstate.questions.forEach(q => { if (!themesOrder.includes(q.theme)) themesOrder.push(q.theme); });
    const groups = themesOrder.map(th => {
      const items = qstate.questions.filter(q => q.theme === th);
      const thTh = items[0] && items[0].themeTh ? items[0].themeTh : '';
      const rows = items.map(q => `<div class="m3-card m3-card-pad" style="margin-bottom:8px;${q.active ? '' : 'opacity:.55'}">
        <div style="display:flex;gap:8px"><span class="m3-badge ${q.type === 'open' ? '' : 'm3-badge--ok'}" style="flex:none">${q.type === 'open' ? 'ปลายเปิด' : 'ให้คะแนน'}</span><div style="flex:1;min-width:0;font-size:14px;line-height:1.5">${esc(q.text)}</div></div>
        <div class="m3-tpl-actions" style="margin-top:8px">
          <button type="button" class="m3-btn m3-btn--ghost" data-q-edit="${esc(q.questionId)}">${mi('edit')}แก้ไข</button>
          <button type="button" class="m3-btn m3-btn--ghost" data-q-toggle="${esc(q.questionId)}">${mi(q.active ? 'visibility_off' : 'visibility')}${q.active ? 'ปิดใช้' : 'เปิดใช้'}</button>
          <button type="button" class="m3-btn m3-btn--ghost" data-q-del="${esc(q.questionId)}" style="color:var(--m3-error)">${mi('delete')}</button>
        </div>
      </div>`).join('');
      return `<div class="m3-section-label" style="margin-top:14px">${esc(th || 'ไม่ระบุหมวด')}${thTh ? ' · ' + esc(thTh) : ''}</div>${rows}`;
    }).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">คลังคำถาม</h2><p class="m3-eyebrow">${esc(relLabel)} · ${qstate.questions.length} ข้อ</p></section>
      <section class="m3-section">${groups || '<div class="m3-empty">ยังไม่มีคำถาม</div>'}</section>
      <section class="m3-section"><button type="button" class="m3-btn m3-btn--tonal" id="qAdd">${mi('add')}เพิ่มคำถาม</button></section>
      <div style="height:30px"></div>`, bar('คลังคำถาม')));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('qAdd').addEventListener('click', () => renderQuestionForm(null));
    document.querySelectorAll('[data-q-edit]').forEach(b => b.addEventListener('click', () => renderQuestionForm(qstate.questions.find(q => q.questionId === b.dataset.qEdit))));
    document.querySelectorAll('[data-q-toggle]').forEach(b => b.addEventListener('click', () => toggleQuestion(qstate.questions.find(q => q.questionId === b.dataset.qToggle))));
    document.querySelectorAll('[data-q-del]').forEach(b => b.addEventListener('click', () => deleteQuestion(b.dataset.qDel)));
  }

  function renderQuestionForm(q) {
    const cur = q || {};
    const themeKeys = Object.keys(qstate.themes);
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">${cur.questionId ? 'แก้ไขคำถาม' : 'เพิ่มคำถาม'}</h2></section>
      <form id="qForm" class="m3-section">
        <input type="hidden" name="questionId" value="${esc(cur.questionId || '')}">
        <input type="hidden" name="relation" value="${esc(cur.relation || qstate.relation)}">
        <label class="m3-elabel">หมวด (Theme)</label>
        <select class="m3-select" name="theme">${themeKeys.map(k => `<option value="${esc(k)}" ${cur.theme === k ? 'selected' : ''}>${esc(k)} · ${esc(qstate.themes[k])}</option>`).join('')}</select>
        <label class="m3-elabel">ประเภท</label>
        <select class="m3-select" name="type"><option value="rating" ${cur.type !== 'open' ? 'selected' : ''}>ให้คะแนน (1-5)</option><option value="open" ${cur.type === 'open' ? 'selected' : ''}>ปลายเปิด (ข้อความ)</option></select>
        <label class="m3-elabel">ข้อความคำถาม</label>
        <textarea class="m3-textarea" name="text" rows="3" required>${esc(cur.text || '')}</textarea>
        <button type="submit" class="m3-btn" style="margin-top:14px">${mi('save')}บันทึก</button>
      </form><div style="height:30px"></div>`, bar('คำถาม')));
    NT.wireM3Nav({ back: () => paintQuestions() });
    document.getElementById('qForm').addEventListener('submit', async e => {
      e.preventDefault();
      const restore = NT.busyButton(e.currentTarget.querySelector('button'), 'กำลังบันทึก...');
      try {
        await NT.api('/360/question/save', Object.fromEntries(new FormData(e.currentTarget).entries()));
        NT.toast('บันทึกคำถามแล้ว');
        await renderQuestions(qstate.relation);
      } catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  async function toggleQuestion(q) {
    if (!q) return;
    try { await NT.api('/360/question/save', { questionId: q.questionId, relation: q.relation, theme: q.theme, type: q.type, text: q.text, active: !q.active }); await renderQuestions(qstate.relation); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function deleteQuestion(questionId) {
    if (!await NT.confirmSheet({ title: 'ลบคำถามนี้?', desc: 'กู้คืนไม่ได้', confirmLabel: 'ลบ', danger: true })) return;
    try { await NT.api('/360/question/delete', { questionId }); NT.toast('ลบแล้ว'); await renderQuestions(qstate.relation); }
    catch (e) { NT.toast(e.message, 'error'); }
  }

  window.FB360 = { renderHome };
})();
