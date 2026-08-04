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
  // Sage skeleton loader (matches KPI / list screens) instead of a lone spinner.
  const skCss = '<style>@keyframes fbshim{0%{background-position:-280px 0}100%{background-position:280px 0}}.fb-sk{background:linear-gradient(90deg,#e4ece8 25%,#f3f9f6 50%,#e4ece8 75%);background-size:560px 100%;animation:fbshim 1.15s ease-in-out infinite;border-radius:8px}</style>';
  const skBox = (w, h, mb) => `<div class="fb-sk" style="width:${w};height:${h || '12px'};${mb ? 'margin-bottom:' + mb + ';' : ''}"></div>`;
  const skCard = () => `<div class="m3-card m3-card-pad" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px">${skBox('55%', '16px')}${skBox('60px', '22px')}</div>${skBox('40%', '12px', '12px')}<div class="fb-sk" style="height:40px;border-radius:12px"></div></div>`;
  const loadingBody = () => `${skCss}<section class="m3-section" style="gap:8px">${skBox('46%', '22px', '6px')}${skBox('72%', '12px')}</section><section class="m3-section">${skCard()}${skCard()}${skCard()}</section>`;

  async function renderHome() {
    NT.render(NT.m3Shell('profile', loadingBody(), bar('360° Feedback')));
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
      <section class="m3-section">
        <h3 class="m3-section-label">รายงานผล (หลังพนักงานตอบ)</h3>
        <button type="button" class="m3-btn m3-btn--tonal" id="fbReports" style="margin-bottom:6px">${mi('insights')}รายงาน Gap รายบุคคล</button>
        <button type="button" class="m3-btn m3-btn--tonal" id="fbGroup" style="margin-bottom:6px">${mi('bar_chart')}รายงานรวม แผนก / องค์กร</button>
        <button type="button" class="m3-btn m3-btn--tonal" id="fbClimate" style="margin-bottom:6px">${mi('apartment')}บรรยากาศองค์กร (ORG)</button>
        <button type="button" class="m3-btn m3-btn--ghost" id="fbSettings">${mi('tune')}ตั้งค่าน้ำหนัก / ผู้ตอบขั้นต่ำ / cutoff / คำอธิบายคะแนน</button>
      </section>
      <div style="height:30px"></div>`, bar('360° Feedback')));
    NT.wireM3Nav({ back: () => NT.goProfile() });
    document.getElementById('fcNew').addEventListener('click', renderCycleForm);
    document.querySelectorAll('[data-q-view]').forEach(b => b.addEventListener('click', () => renderQuestions(b.dataset.qView)));
    document.querySelectorAll('[data-fc-del]').forEach(b => b.addEventListener('click', () => deleteCycle(b.dataset.fcDel)));
    document.querySelectorAll('[data-fc-pair]').forEach(b => b.addEventListener('click', () => renderPairing(b.dataset.fcPair)));
    document.getElementById('fbReports').addEventListener('click', () => renderReports(null));
    document.getElementById('fbGroup').addEventListener('click', () => renderGroupReport(null, null));
    document.getElementById('fbClimate').addEventListener('click', () => renderClimate(null));
    document.getElementById('fbSettings').addEventListener('click', renderSettings);
  }

  // ============================================================================
  // Phase B — pairing preview / confirm
  // ============================================================================
  const pstate = { cycleId: null, data: null, view: 'hub' };  // view: hub | boss | peer | noboss
  async function loadPairing() { pstate.data = await NT.api('/360/pairing/list', { cycleId: pstate.cycleId }); }
  async function renderPairing(cycleId) {
    pstate.cycleId = cycleId; pstate.view = 'queue';
    NT.render(NT.m3Shell('profile', loadingBody(), bar('จัดการคู่ประเมิน')));
    NT.wireM3Nav({ back: () => paint() });
    try { await loadPairing(); paintPairing(); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('จัดการคู่ประเมิน')));
      NT.wireM3Nav({ back: () => paint() });
    }
  }

  // Searchable person picker (type-to-filter + tap-to-pick) over the whole Master Data pool.
  // A button that opens NT.pickPeople — replaces the old inline combobox. The dropdown had to live
  // inside a 375px card, so its filter chips needed ~2,100px to show 30 branches and its list was
  // capped at 40 of 422. A sheet owns the screen and can use native <select> instead.
  function pickerBtn(key, selId, selName, ph) {
    return `<button type="button" class="m3-input fpk" data-cb="${esc(key)}" data-id="${esc(selId || '')}"
      style="flex:1;min-width:0;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--m3-surface-lowest);color:${selName ? 'var(--m3-on-surface)' : 'var(--m3-muted)'};font-weight:400">
      <span class="fpk-lb" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(selName || ph || 'แตะเพื่อเลือก')}</span>${mi('expand_more')}
    </button>`;
  }
  function comboId(key) { const b = document.querySelector(`.fpk[data-cb="${key}"]`); return b ? b.dataset.id : ''; }
  // Wire every picker button: tapping opens the sheet, picking writes back into the button.
  function wirePickers() {
    const people = (pstate.data && pstate.data.people) || [];
    document.querySelectorAll('.fpk').forEach(btn => {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';
      btn.addEventListener('click', async () => {
        const key = btn.dataset.cb;
        const isPeer = key.startsWith('peer:');
        const subjectId = key.split(':')[1];
        const picked = await NT.pickPeople({
          title: isPeer ? 'เพิ่มเพื่อนร่วมงานที่จะประเมิน' : 'เลือกหัวหน้าผู้ประเมิน',
          people,
          multi: isPeer,                // peers come in threes — checking them one at a time is a tax
          exclude: [subjectId]          // nobody evaluates themselves
        });
        if (!picked || !picked.length) return;
        if (isPeer) return addPeers(subjectId, picked);
        btn.dataset.id = picked[0];
        const p = people.find(x => x.id === picked[0]);
        btn.querySelector('.fpk-lb').textContent = p ? p.name : picked[0];
        btn.style.color = 'var(--m3-on-surface)';
      });
    });
  }

  // Distinct values for a field, in a stable order — drives the filter chips.
  function facetsOf(people, field) {
    return [...new Set(people.map(p => (p[field] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
  }

  // The haystack every .pcard is filtered against. Boss/peer rows only carry names from the API, so
  // look each person's org info up locally — otherwise a department chip silently matches nothing on
  // exactly the screens where pairing decisions get made.
  function pcardHay(...ids) {
    const people = (pstate.data && pstate.data.people) || [];
    const bits = [];
    ids.filter(Boolean).forEach(id => {
      const p = people.find(x => x.id === id);
      if (p) bits.push(p.name, p.department, p.branch, p.jobGroup);
    });
    return esc(bits.filter(Boolean).join(' ').toLowerCase());
  }

  // Hub → drill-in. With ~700 assignments a single flat list is unusable on mobile, so the landing
  // page is a compact hub of tappable counts; each axis opens its own scoped, searchable list.
  const isSent = () => { const c = pstate.data && pstate.data.cycle; return Boolean(c && c.status && c.status !== 'draft'); };
  const backToHub = () => { pstate.view = 'browse'; paintPairing(); };       // drill-ins return to the browse hub
  const backToQueue = () => { pstate.view = 'queue'; paintPairing(); };

  function paintPairing() {
    const d = pstate.data;
    if (!d || !d.total) return paintPairEmpty();
    if (pstate.view === 'boss') return paintBossView();
    if (pstate.view === 'peer') return paintPeerView();
    if (pstate.view === 'noboss') return paintNoBossView();
    if (pstate.view === 'browse') return paintPairHub();
    return isSent() ? paintPairSent() : paintPairQueue();     // queue is the landing while draft
  }

  function paintPairEmpty() {
    const c = (pstate.data && pstate.data.cycle) || {};
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">จัดการคู่ประเมิน</h2><p class="m3-eyebrow">${c.year ? 'ปี ' + c.year + ' · ' + c.period : ''}</p></section>
      <section class="m3-section"><div class="m3-empty">ยังไม่ได้จับคู่ · กดปุ่มด้านล่างให้ระบบสร้างคู่อัตโนมัติ (SELF/ORG ทุกคน · PEER/BOSS ตามกฎ) แล้วรีวิวก่อนส่ง</div>
      <button type="button" class="m3-btn" id="pGen" style="margin-top:10px">${mi('auto_awesome')}สร้างคู่อัตโนมัติ</button></section>`, bar('จัดการคู่ประเมิน')));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('pGen').addEventListener('click', generatePairing);
  }

  // Compact search input; filters already-rendered .pcard rows by their data-name (no re-render,
  // so combobox state + focus survive).
  // Department chips ride alongside: HR thinks "who's left in คลังสินค้า", not "what was that name
  // again". Typing only works when you already remember the answer.
  function searchBox(ph) {
    const depts = facetsOf((pstate.data && pstate.data.people) || [], 'department');
    const chips = depts.length > 1
      ? `<div class="m3-chip-row" style="margin-bottom:8px" id="pDeptChips">
          ${depts.map(d => `<button type="button" class="m3-chip" data-pdept="${esc(d)}">${esc(d)}</button>`).join('')}
        </div>`
      : '';
    return `<div class="m3-search" style="margin-bottom:8px">${mi('search')}<input type="text" id="pSearch" placeholder="${ph}" autocomplete="off"></div>${chips}
      <div id="pFilterCount" style="font-size:11px;color:var(--m3-muted);margin-bottom:8px;display:none"></div>`;
  }
  function wireSearch() {
    const inp = document.getElementById('pSearch');
    const chips = document.getElementById('pDeptChips');
    if (!inp && !chips) return;
    let dept = '';
    const apply = () => {
      const q = inp ? inp.value.trim().toLowerCase() : '';
      const cards = document.querySelectorAll('.pcard');
      let n = 0;
      cards.forEach(el => {
        const hay = el.dataset.name || '';
        const hit = (!q || hay.includes(q)) && (!dept || hay.includes(dept.toLowerCase()));
        el.style.display = hit ? '' : 'none';
        if (hit) n++;
      });
      const cnt = document.getElementById('pFilterCount');
      if (cnt) {
        const on = q || dept;
        cnt.style.display = on ? '' : 'none';
        cnt.textContent = on ? `แสดง ${n} จาก ${cards.length} รายการ` : '';
      }
    };
    if (inp) inp.addEventListener('input', apply);
    if (chips) chips.querySelectorAll('[data-pdept]').forEach(b => b.addEventListener('click', () => {
      dept = dept === b.dataset.pdept ? '' : b.dataset.pdept;   // tap again = off
      chips.querySelectorAll('[data-pdept]').forEach(x => x.classList.toggle('m3-chip--filled', x.dataset.pdept === dept));
      apply();
    }));
  }

  function paintPairHub() {
    const d = pstate.data, c = d.cycle || {}, cnt = d.counts || {}, sent = isSent();
    const noBossN = (d.noBoss || []).length;
    const crossN = (d.peerGroups || []).reduce((s, g) => s + g.evaluators.filter(e => e.cross).length, 0);
    const row = (icon, title, sub, view, alert) => `
      <button type="button" class="m3-card m3-card-pad"${view ? ` data-pview="${view}"` : ' disabled'} style="width:100%;text-align:left;background:none;display:flex;align-items:center;gap:12px;margin-bottom:8px;border:1px solid ${alert ? 'var(--m3-error)' : 'var(--m3-outline-variant)'};${view ? 'cursor:pointer' : 'opacity:.7'}">
        <div class="m3-list-icon" style="flex:none;${alert ? 'background:var(--m3-error);color:#fff' : ''}">${mi(icon)}</div>
        <div style="flex:1;min-width:0"><div class="m3-staff-name"${alert ? ' style="color:var(--m3-error)"' : ''}>${title}</div><div class="m3-staff-role">${sub}</div></div>
        ${view ? mi('chevron_right') : ''}
      </button>`;
    const summary = `<div class="m3-card m3-card-pad"><div style="display:flex;flex-wrap:wrap;gap:6px">
      <span class="m3-badge m3-badge--ok">SELF ${cnt.self || 0}</span><span class="m3-badge m3-badge--ok">PEER ${cnt.peer || 0}</span>
      <span class="m3-badge m3-badge--ok">BOSS ${cnt.boss || 0}</span><span class="m3-badge m3-badge--ok">ORG ${cnt.org || 0}</span>
      <span class="m3-badge">รวม ${d.total}</span></div></div>`;
    const nav =
      (!sent && noBossN ? row('warning', `ยังไม่มีหัวหน้า (${noBossN})`, 'แตะเพื่อกำหนดหัวหน้าให้ครบ', 'noboss', true) : '') +
      row('supervisor_account', `หัวหน้างาน (BOSS) · ${(d.bossRows || []).length} คู่`, sent ? 'ดูรายการ' : 'ตรวจ / เปลี่ยนหัวหน้า', 'boss') +
      row('groups', `เพื่อนร่วมงาน (PEER) · ${(d.peerGroups || []).length} คน`, (sent ? 'ดูรายการ' : 'ตรวจ / เพิ่ม-ลบผู้ประเมิน') + (crossN ? ` · ⚠️ ข้ามแผนก ${crossN}` : ''), 'peer') +
      row('task_alt', `SELF ${cnt.self || 0} · ORG ${cnt.org || 0}`, 'จับอัตโนมัติทุกคน — ไม่ต้องรีวิว', null);
    const footer = sent
      ? `<div class="m3-card m3-card-pad" style="border-color:var(--m3-primary);text-align:center"><span class="m3-staff-name">${mi('verified')} ส่งแล้ว (สถานะ ${esc(c.status)})</span><p class="m3-save-hint">พนักงานเริ่มตอบได้ · แก้คู่ไม่ได้แล้ว</p></div>`
      : `<button type="button" class="m3-btn" id="pConfirm">${mi('send')}ยืนยัน + ส่งให้พนักงาน</button>
         <button type="button" class="m3-btn m3-btn--ghost" id="pRegen" style="margin-top:8px">${mi('refresh')}สร้างคู่ใหม่ (ล้างของเดิม)</button>
         <p class="m3-save-hint" style="text-align:left">ยืนยันแล้ว = ส่งให้พนักงานตอบ · แก้คู่ไม่ได้อีก (ตรวจให้ครบก่อน)</p>`;
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">จัดการคู่ประเมิน</h2><p class="m3-eyebrow">${c.year ? 'ปี ' + c.year + ' · ' + c.period : ''} · แตะแต่ละชุดเพื่อรีวิว</p></section>
      <section class="m3-section">${summary}</section>
      <section class="m3-section">${nav}</section>
      <section class="m3-section">${footer}</section>
      <div style="height:30px"></div>`, bar('จัดการคู่ประเมิน')));
    NT.wireM3Nav({ back: () => backToQueue() });
    document.querySelectorAll('[data-pview]').forEach(b => b.addEventListener('click', () => { pstate.view = b.dataset.pview; paintPairing(); }));
    const cf = document.getElementById('pConfirm'); if (cf) cf.addEventListener('click', confirmPairing);
    const rg = document.getElementById('pRegen'); if (rg) rg.addEventListener('click', generatePairing);
  }

  // Exception queue (draft landing): only what needs a human decision — no-boss + unreviewed
  // cross-department peers. Everything the rules paired cleanly is trusted (see it via "ดูทั้งหมด").
  function paintPairQueue() {
    const d = pstate.data, c = d.cycle || {};
    const noBoss = d.noBoss || [];
    const crossUnrev = [];
    (d.peerGroups || []).forEach(g => g.evaluators.forEach(ev => { if (ev.cross && !ev.reviewed) crossUnrev.push({ assignmentId: ev.assignmentId, evaluatorName: ev.evaluatorName, subjectName: g.subjectName }); }));
    const decisions = noBoss.length + crossUnrev.length;
    const cnt = d.counts || {};
    const trusted = Math.max(0, (cnt.boss || 0) + (cnt.peer || 0) - crossUnrev.length);
    const hero = `<div class="m3-card" style="padding:16px;border:0;background:var(--m3-primary);color:#fff;border-radius:14px">
      <div style="font-size:30px;font-weight:600;line-height:1">${decisions}</div>
      <div style="font-size:13px;opacity:.92;margin-top:2px">${decisions ? 'รายการที่ต้องตัดสินใจ · ที่เหลือระบบจับให้แล้ว' : 'เคลียร์ครบแล้ว 🎉 พร้อมส่ง'}</div></div>`;
    const noBossSec = noBoss.length ? `<div class="m3-section-label" style="margin-top:14px;color:var(--m3-error)">${mi('warning')} ไม่มีหัวหน้า — เลือกให้เอง (${noBoss.length})</div>` +
      noBoss.map(p => `<div class="m3-card m3-card-pad pcard" data-name="${pcardHay(p.id)}" style="margin-bottom:8px;border:1px solid var(--m3-error)">
        <div class="m3-staff-name">${esc(p.name)}</div><div class="m3-staff-role">${esc(p.department || '')} · ยังไม่มีหัวหน้าในระบบ</div>
        <div style="display:flex;gap:8px;margin-top:8px">${pickerBtn('boss:' + p.id, '', '', 'เลือกหัวหน้า')}<button type="button" class="m3-btn m3-btn--tonal pBossSet" data-sub="${esc(p.id)}" style="width:auto;flex:none">${mi('check')}</button></div>
      </div>`).join('') : '';
    const crossSec = crossUnrev.length ? `<div class="m3-section-label" style="margin-top:14px;color:var(--m3-error)">${mi('alt_route')} เพื่อนข้ามแผนก — ตรวจ (${crossUnrev.length})</div>
      <button type="button" class="m3-btn m3-btn--ghost" id="pAcceptAll" style="margin-bottom:8px">${mi('done_all')}ยอมรับข้ามแผนกที่เหลือทั้งหมด</button>` +
      crossUnrev.map(ev => `<div class="m3-card m3-card-pad pcard" data-name="${pcardHay(ev.subjectId, ev.evaluatorId)}" style="margin-bottom:8px;border:1px solid var(--m3-error)">
        <div class="m3-staff-name" style="font-size:14px">ประเมิน: ${esc(ev.subjectName)}</div>
        <div class="m3-staff-role">ผู้ประเมิน: ${esc(ev.evaluatorName)} · <span style="color:var(--m3-error)">ข้ามแผนก</span></div>
        <div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="m3-btn m3-btn--ghost pRemove" data-aid="${esc(ev.assignmentId)}" style="flex:1;color:var(--m3-error)">${mi('close')}เอาออก</button><button type="button" class="m3-btn m3-btn--tonal pAccept" data-aid="${esc(ev.assignmentId)}" style="flex:1">${mi('check')}โอเค ใช้ได้</button></div>
      </div>`).join('') : '';
    const trustedCard = `<div class="m3-section-label" style="margin-top:14px">${mi('verified')} จับตามกฎเรียบร้อย</div>
      <button type="button" class="m3-card m3-card-pad" id="pBrowse" style="width:100%;text-align:left;background:none;display:flex;align-items:center;gap:12px;border:1px solid var(--m3-outline-variant);cursor:pointer">
        <div class="m3-list-icon" style="flex:none">${mi('check')}</div>
        <div style="flex:1;min-width:0"><div class="m3-staff-name">${trusted} คู่ · BOSS + PEER</div><div class="m3-staff-role">ตรงเกณฑ์ rank/แผนก/level — ไม่ต้องรีวิว</div></div>
        <span style="color:var(--m3-primary);font-weight:600;white-space:nowrap">ดูทั้งหมด ›</span>
      </button>
      <div style="display:flex;align-items:center;gap:12px;padding:12px;opacity:.7;font-size:13px;color:var(--m3-on-surface-variant)">${mi('groups')} SELF ${cnt.self || 0} · ORG ${cnt.org || 0} — จับอัตโนมัติทุกคน</div>`;
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">จัดการคู่ประเมิน</h2><p class="m3-eyebrow">${c.year ? 'ปี ' + c.year + ' · ' + c.period : ''} · เคลียร์เฉพาะที่ต้องตัดสินใจ</p></section>
      <section class="m3-section">${hero}</section>
      <section class="m3-section">${noBossSec}${crossSec}${trustedCard}</section>
      <section class="m3-section"><button type="button" class="m3-btn" id="pConfirm">${mi('send')}ยืนยัน + ส่งให้พนักงาน</button>
        <button type="button" class="m3-btn m3-btn--ghost" id="pRegen" style="margin-top:8px">${mi('refresh')}สร้างคู่ใหม่ (ล้างของเดิม)</button>
        ${decisions ? `<p class="m3-save-hint" style="text-align:left;color:var(--m3-error)">ยังเหลือ ${decisions} รายการที่ยังไม่จัดการ — ส่งได้แต่จะเตือนก่อน</p>` : '<p class="m3-save-hint" style="text-align:left">พร้อมส่งแล้ว</p>'}</section>
      <div style="height:30px"></div>`, bar('จัดการคู่ประเมิน')));
    NT.wireM3Nav({ back: () => paint() });
    wirePickers();
    document.querySelectorAll('.pBossSet').forEach(b => b.addEventListener('click', () => setBoss(b.dataset.sub)));
    document.querySelectorAll('.pAccept').forEach(b => b.addEventListener('click', () => acceptPeer(b.dataset.aid)));
    document.querySelectorAll('.pRemove').forEach(b => b.addEventListener('click', () => removeAssignment(b.dataset.aid)));
    const aa = document.getElementById('pAcceptAll'); if (aa) aa.addEventListener('click', acceptAllCross);
    document.getElementById('pBrowse').addEventListener('click', () => { pstate.view = 'browse'; paintPairing(); });
    document.getElementById('pConfirm').addEventListener('click', () => confirmPairing(decisions));
    document.getElementById('pRegen').addEventListener('click', generatePairing);
  }

  // Sent/active or closed cycle: status + lifecycle controls (unsend / close / reopen) + browse.
  function paintPairSent() {
    const d = pstate.data, c = d.cycle || {}, cnt = d.counts || {}, closed = c.status === 'closed';
    const summary = `<div class="m3-card m3-card-pad"><div style="display:flex;flex-wrap:wrap;gap:6px">
      <span class="m3-badge m3-badge--ok">SELF ${cnt.self || 0}</span><span class="m3-badge m3-badge--ok">PEER ${cnt.peer || 0}</span>
      <span class="m3-badge m3-badge--ok">BOSS ${cnt.boss || 0}</span><span class="m3-badge m3-badge--ok">ORG ${cnt.org || 0}</span>
      <span class="m3-badge">รวม ${d.total}</span></div></div>`;
    const banner = `<div class="m3-card m3-card-pad" style="border-color:var(--m3-primary);text-align:center">
      <span class="m3-staff-name">${mi(closed ? 'lock' : 'verified')} ${closed ? 'ปิดรอบแล้ว — หยุดรับคำตอบ' : 'ส่งแล้ว · พนักงานกำลังตอบได้'}</span>
      <p class="m3-save-hint">${closed ? 'ไปดูรายงานผลได้ที่หน้า 360' : 'สถานะ ' + esc(c.status)}</p></div>`;
    const controls = closed
      ? `<button type="button" class="m3-btn" id="pReopen">${mi('lock_open')}เปิดรอบใหม่ (รับคำตอบต่อ)</button>`
      : `<button type="button" class="m3-btn m3-btn--ghost" id="pUnsend">${mi('undo')}ยกเลิกการส่ง (กลับไปแก้คู่)</button>
         <button type="button" class="m3-btn m3-btn--ghost" id="pClose" style="margin-top:8px">${mi('lock')}ปิดรอบ (หยุดรับคำตอบ)</button>`;
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">จัดการคู่ประเมิน</h2><p class="m3-eyebrow">${c.year ? 'ปี ' + c.year + ' · ' + c.period : ''}</p></section>
      <section class="m3-section">${banner}${summary}</section>
      <section class="m3-section">
        <button type="button" class="m3-btn m3-btn--tonal" id="pBrowse" style="margin-bottom:10px">${mi('list')}ดูคู่ทั้งหมด</button>
        ${controls}
        <p class="m3-save-hint" style="text-align:left">ยกเลิกการส่ง = กลับไปแก้คู่ได้ · คำตอบที่ตอบไปแล้วไม่หาย</p>
      </section>
      <div style="height:30px"></div>`, bar('จัดการคู่ประเมิน')));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('pBrowse').addEventListener('click', () => { pstate.view = 'browse'; paintPairing(); });
    const u = document.getElementById('pUnsend'); if (u) u.addEventListener('click', unsendCycle);
    const cl = document.getElementById('pClose'); if (cl) cl.addEventListener('click', closeCycle);
    const ro = document.getElementById('pReopen'); if (ro) ro.addEventListener('click', reopenCycle);
  }

  function paintNoBossView() {
    const noBoss = pstate.data.noBoss || [];
    const cards = noBoss.map(p => `<div class="m3-card m3-card-pad pcard" data-name="${pcardHay(p.id)}" style="margin-bottom:8px">
      <div class="m3-staff-name">${esc(p.name)}</div><div class="m3-staff-role">${esc(p.department || '')}</div>
      <div style="display:flex;gap:8px;margin-top:8px">${pickerBtn('boss:' + p.id, '', '', 'เลือกหัวหน้า')}<button type="button" class="m3-btn m3-btn--tonal pBossSet" data-sub="${esc(p.id)}" style="width:auto;flex:none">${mi('check')}</button></div>
    </div>`).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">ยังไม่มีหัวหน้า (${noBoss.length})</h2><p class="m3-eyebrow">กำหนดหัวหน้าให้แต่ละคน (พิมพ์ชื่อค้นหา)</p></section>
      <section class="m3-section">${searchBox('ค้นหาชื่อ / แผนก')}${cards || '<div class="m3-empty">ครบแล้ว ทุกคนมีหัวหน้า 🎉</div>'}</section>
      <div style="height:30px"></div>`, bar('กำหนดหัวหน้า')));
    NT.wireM3Nav({ back: () => backToHub() });
    wirePickers(); wireSearch();
    document.querySelectorAll('.pBossSet').forEach(b => b.addEventListener('click', () => setBoss(b.dataset.sub)));
  }

  function paintBossView() {
    const d = pstate.data, sent = isSent();
    const rows = (d.bossRows || []).map(b => `<div class="m3-card m3-card-pad pcard" data-name="${pcardHay(b.subordinateId, b.bossId)}" style="margin-bottom:8px">
      <div class="m3-staff-role">${esc(b.subordinateName)} → <strong>${esc(b.bossName || '—')}</strong></div>
      ${sent ? '' : `<div style="display:flex;gap:8px;margin-top:6px">${pickerBtn('boss:' + b.subordinateId, b.bossId, b.bossName, 'เปลี่ยนหัวหน้า')}<button type="button" class="m3-btn m3-btn--ghost pBossSet" data-sub="${esc(b.subordinateId)}" style="width:auto;flex:none">${mi('sync')}</button></div>`}
    </div>`).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">หัวหน้างาน (BOSS)</h2><p class="m3-eyebrow">ลูกน้อง → หัวหน้า · ${(d.bossRows || []).length} คู่</p></section>
      <section class="m3-section">${searchBox('ค้นหาชื่อลูกน้อง / หัวหน้า')}${rows || '<div class="m3-empty">—</div>'}</section>
      <div style="height:30px"></div>`, bar('หัวหน้างาน (BOSS)')));
    NT.wireM3Nav({ back: () => backToHub() });
    wireSearch();
    if (!sent) { wirePickers(); document.querySelectorAll('.pBossSet').forEach(b => b.addEventListener('click', () => setBoss(b.dataset.sub))); }
  }

  function paintPeerView() {
    const d = pstate.data, sent = isSent();
    const groups = (d.peerGroups || []).map(g => `<div class="m3-card m3-card-pad pcard" data-name="${pcardHay(g.subjectId, ...g.evaluators.map(e => e.evaluatorId))}" style="margin-bottom:8px">
      <div class="m3-staff-name">ผู้ถูกประเมิน: ${esc(g.subjectName)}</div>
      <div style="margin-top:6px">${g.evaluators.map(ev => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0"><span>${esc(ev.evaluatorName)}${ev.cross ? ' <span class="m3-badge m3-badge--warn">ข้ามแผนก</span>' : ''}</span>${sent ? '' : `<button type="button" class="m3-btn m3-btn--ghost pRemove" data-aid="${esc(ev.assignmentId)}" style="width:auto;flex:none;min-height:32px;color:var(--m3-error)">${mi('close')}</button>`}</div>`).join('')}</div>
      ${sent ? '' : `<div style="margin-top:8px">${pickerBtn('peer:' + g.subjectId, '', '', 'เพิ่มเพื่อนร่วมงาน')}</div>`}
    </div>`).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">เพื่อนร่วมงาน (PEER)</h2><p class="m3-eyebrow">ใครประเมินใคร · ${(d.peerGroups || []).length} คนถูกประเมิน</p></section>
      <section class="m3-section">${searchBox('ค้นหาชื่อผู้ถูกประเมิน / ผู้ประเมิน')}${groups || '<div class="m3-empty">—</div>'}</section>
      <div style="height:30px"></div>`, bar('เพื่อนร่วมงาน (PEER)')));
    NT.wireM3Nav({ back: () => backToHub() });
    wireSearch();
    if (!sent) {
      wirePickers();   // peer picker adds everyone checked in one go — no separate "add" button
      document.querySelectorAll('.pRemove').forEach(b => b.addEventListener('click', () => removeAssignment(b.dataset.aid)));
    }
  }

  async function generatePairing() {
    if (pstate.data && pstate.data.total && !await NT.confirmSheet({ title: 'สร้างคู่ใหม่?', desc: 'ล้างการจับคู่เดิมทั้งหมดแล้วสร้างใหม่', confirmLabel: 'สร้างใหม่', danger: true })) return;
    try { const r = await NT.api('/360/pairing/generate', { cycleId: pstate.cycleId }); NT.toast(`สร้างคู่แล้ว ${r.count} รายการ${r.excluded ? ` · กัน cutoff ${r.excluded} คน` : ''}`); pstate.view = 'queue'; await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function setBoss(sub) {
    const bossId = comboId('boss:' + sub);
    if (!bossId) { NT.toast('พิมพ์/เลือกหัวหน้าก่อน', 'error'); return; }
    try { await NT.api('/360/pairing/setboss', { cycleId: pstate.cycleId, subordinateId: sub, bossId }); NT.toast('ตั้งหัวหน้าแล้ว'); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  // The picker returns everyone checked at once; /360/pairing/addpeer takes one peer per call, so
  // fan out here. Partial failure is reported rather than swallowed — silently adding 2 of 3 peers
  // would leave HR believing a pairing exists that doesn't.
  async function addPeers(subj, peerIds) {
    const ids = (peerIds || []).filter(Boolean);
    if (!ids.length) return;
    let ok = 0; const failed = [];
    for (const peerId of ids) {
      try { await NT.api('/360/pairing/addpeer', { cycleId: pstate.cycleId, subjectId: subj, peerId }); ok++; }
      catch (e) { failed.push(e.message); }
    }
    if (ok) NT.toast(`เพิ่มผู้ประเมินแล้ว ${ok} คน`);
    if (failed.length) NT.toast(`เพิ่มไม่สำเร็จ ${failed.length} คน · ${failed[0]}`, 'error');
    await loadPairing(); paintPairing();
  }
  async function removeAssignment(aid) {
    try { await NT.api('/360/pairing/remove', { assignmentId: aid }); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function confirmPairing(decisions) {
    const desc = decisions ? `ยังเหลือ ${decisions} รายการที่ยังไม่จัดการ (ไม่มีหัวหน้า/ข้ามแผนก) · ส่งเลยไหม?` : 'ส่งให้พนักงานเริ่มตอบ · ยกเลิกส่งภายหลังได้';
    if (!await NT.confirmSheet({ title: 'ยืนยัน + ส่ง?', desc, confirmLabel: 'ส่ง', danger: Boolean(decisions) })) return;
    try { const r = await NT.api('/360/pairing/confirm', { cycleId: pstate.cycleId }); NT.toast(`ส่งแล้ว ${r.count} รายการ`); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function acceptPeer(aid) {
    try { await NT.api('/360/pairing/acceptpeer', { assignmentId: aid }); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function acceptAllCross() {
    if (!await NT.confirmSheet({ title: 'ยอมรับข้ามแผนกทั้งหมด?', desc: 'ทำเครื่องหมายคู่ข้ามแผนกที่เหลือว่า "ตรวจแล้ว"', confirmLabel: 'ยอมรับ' })) return;
    try { await NT.api('/360/pairing/acceptallcross', { cycleId: pstate.cycleId }); NT.toast('ยอมรับแล้ว'); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function unsendCycle() {
    if (!await NT.confirmSheet({ title: 'ยกเลิกการส่ง?', desc: 'กลับไปแก้คู่ได้ · พนักงานจะตอบต่อไม่ได้จนกว่าส่งใหม่ · คำตอบที่ตอบแล้วไม่หาย', confirmLabel: 'ยกเลิกการส่ง', danger: true })) return;
    try { await NT.api('/360/pairing/unsend', { cycleId: pstate.cycleId }); NT.toast('กลับเป็นร่างแล้ว'); pstate.view = 'queue'; await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function closeCycle() {
    if (!await NT.confirmSheet({ title: 'ปิดรอบ?', desc: 'หยุดรับคำตอบ เพื่อไปสรุปรายงาน · เปิดใหม่ได้ภายหลัง', confirmLabel: 'ปิดรอบ' })) return;
    try { await NT.api('/360/pairing/close', { cycleId: pstate.cycleId }); NT.toast('ปิดรอบแล้ว'); await loadPairing(); paintPairing(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }
  async function reopenCycle() {
    try { await NT.api('/360/pairing/reopen', { cycleId: pstate.cycleId }); NT.toast('เปิดรอบใหม่แล้ว'); await loadPairing(); paintPairing(); }
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
    if (!await NT.confirmSheet({ title: 'ลบรอบนี้?', desc: 'ลบรอบ + การจับคู่ + คำตอบทั้งหมด + รายงาน ของรอบนี้ · กู้คืนไม่ได้ (คลังคำถามไม่ถูกลบ)', confirmLabel: 'ลบทั้งหมด', danger: true })) return;
    try { await NT.api('/360/cycle/delete', { cycleId }); NT.toast('ลบรอบแล้ว'); await renderHome(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }

  // ---- Question bank CMS (per axis) ----
  const qstate = { relation: null, questions: [], themes: {} };
  async function renderQuestions(relation) {
    qstate.relation = relation;
    NT.render(NT.m3Shell('profile', loadingBody(), bar('คลังคำถาม')));
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

  // ============================================================================
  // Phase C — employee answers their assigned surveys (self/peer/boss/org).
  // Entry: window.FB360.renderMyFeedback (from the portal profile tab).
  // ============================================================================
  const RELATION_ORDER = ['self', 'peer', 'boss', 'org'];
  const RELATION_MY = {
    self: { label: 'ประเมินตนเอง', icon: 'person', lead: '' },
    peer: { label: 'เพื่อนร่วมงาน', icon: 'groups', lead: 'ประเมิน: ' },
    boss: { label: 'หัวหน้างาน', icon: 'supervisor_account', lead: 'ประเมิน: ' },
    org: { label: 'องค์กร', icon: 'apartment', lead: '' }
  };
  // 360 rating scale 1-5 (5 = ดีเยี่ยม). The caption rides on every button (same as probation
  // Competency / OB Feedback): a legend at the top of a 22-question form is off-screen by Q3, so
  // people end up guessing what 4 vs 5 means exactly where the answer has to be precise.
  // Standard wording; HR overrides it per level in ตั้งค่า 360 (stored in app_settings, arrives with
  // the form). A blank slot falls back to the standard word — same rule as OB Feedback captions.
  const SCALE_360_DEFAULT = ['ต้องปรับปรุง', 'ควรพัฒนา', 'ตามที่คาดหวัง', 'สูงกว่าคาดหวัง', 'ดีเยี่ยม'];
  function scaleCaps(labels) {
    const list = Array.isArray(labels) ? labels : [];
    return SCALE_360_DEFAULT.map((def, i) => {
      const v = list[i] == null ? '' : String(list[i]).trim();
      return { v: i + 1, cap: v || def };
    });
  }
  function ratingRow(name, current, labels) {
    return `<div class="m3-scalegrid" style="grid-template-columns:repeat(5,1fr);margin-top:8px">${scaleCaps(labels).map(s =>
      `<label class="m3-scorebtn m3-scorebtn--cap"><input type="radio" name="${name}" value="${s.v}"${String(current) === String(s.v) ? ' checked' : ''}><span class="num">${s.v}</span><span class="cap">${esc(s.cap)}</span></label>`).join('')}</div>`;
  }

  const mystate = { assignments: [] };
  async function renderMyFeedback() {
    NT.render(NT.m3Shell('profile', loadingBody(), bar('แบบประเมิน 360° ของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    try {
      const d = await NT.api('/360/my', {});
      mystate.assignments = d.assignments || [];
      paintMyFeedback();
    } catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} โหลดไม่สำเร็จ: ${esc(e.message || '')}</div></section>`, bar('แบบประเมิน 360° ของฉัน')));
      NT.wireM3Nav({ back: () => NT.goPortal() });
    }
  }

  function paintMyFeedback() {
    const list = mystate.assignments;
    if (!list.length) {
      NT.render(NT.m3Shell('profile', `
        <section class="m3-section" style="gap:4px"><h2 class="m3-title">แบบประเมิน 360°</h2></section>
        <section class="m3-section"><div class="m3-empty">${mi('done_all')} ยังไม่มีแบบประเมินที่ต้องทำ<br><span style="font-size:12px">เมื่อ HR เปิดรอบและส่งให้ คุณจะเห็นรายการที่นี่</span></div></section>`, bar('แบบประเมิน 360° ของฉัน')));
      NT.wireM3Nav({ back: () => NT.goPortal() });
      return;
    }
    const done = list.filter(a => a.done).length;
    const groups = RELATION_ORDER.filter(rel => list.some(a => a.relation === rel)).map(rel => {
      const meta = RELATION_MY[rel];
      const items = list.filter(a => a.relation === rel);
      const cards = items.map(a => {
        const title = rel === 'org' ? 'ประเมินองค์กร' : rel === 'self' ? 'ประเมินตนเอง' : `${meta.lead}${esc(a.subjectName || '-')}`;
        return `<button type="button" class="m3-card m3-card-pad" data-fb-do="${esc(a.assignmentId)}" style="width:100%;text-align:left;border:1px solid ${a.done ? 'var(--m3-outline-variant)' : 'var(--m3-primary)'};background:none;display:flex;align-items:center;gap:12px;margin-bottom:8px;cursor:pointer">
          <div class="m3-list-icon" style="flex:none">${mi(meta.icon)}</div>
          <div style="flex:1;min-width:0"><div class="m3-staff-name">${title}</div><div class="m3-staff-role">${meta.label}${a.year ? ' · ปี ' + a.year + ' ' + a.period : ''}</div></div>
          <span class="m3-badge ${a.done ? 'm3-badge--ok' : 'm3-badge--warn'}" style="flex:none">${a.done ? 'เสร็จแล้ว' : 'รอทำ'}</span>
        </button>`;
      }).join('');
      return `<div class="m3-section-label" style="margin-top:14px">${meta.label} (${items.length})</div>${cards}`;
    }).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">แบบประเมิน 360°</h2><p class="m3-eyebrow">คำตอบของคุณเป็นความลับ · ผู้ถูกประเมินไม่เห็นว่าใครให้คะแนน</p></section>
      <section class="m3-section"><div class="m3-card m3-card-pad" style="display:flex;justify-content:space-between;align-items:center">
        <span class="m3-staff-name">ความคืบหน้า</span><span class="m3-badge ${done === list.length ? 'm3-badge--ok' : ''}">${done}/${list.length} เสร็จ</span></div></section>
      <section class="m3-section">${groups}</section>
      <div style="height:30px"></div>`, bar('แบบประเมิน 360° ของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    document.querySelectorAll('[data-fb-do]').forEach(b => b.addEventListener('click', () => renderFeedbackForm(b.dataset.fbDo)));
  }

  const fstate = { assignmentId: null, data: null };
  async function renderFeedbackForm(assignmentId) {
    fstate.assignmentId = assignmentId;
    NT.render(NT.m3Shell('profile', loadingBody(), bar('แบบประเมิน')));
    NT.wireM3Nav({ back: () => paintMyFeedback() });
    try {
      fstate.data = await NT.api('/360/form', { assignmentId });
      paintFeedbackForm();
    } catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('แบบประเมิน')));
      NT.wireM3Nav({ back: () => paintMyFeedback() });
    }
  }

  function paintFeedbackForm() {
    const d = fstate.data, a = d.assignment, qs = d.questions || [], ans = d.answers || {};
    const heading = a.relation === 'org' ? 'ประเมินองค์กร' : a.relation === 'self' ? 'ประเมินตนเอง' : `ประเมิน: ${esc(a.subjectName || '-')}`;
    // No scale legend card: every button now carries its own caption, so a legend would just repeat
    // itself 22 times over — and it was the thing that scrolled off-screen in the first place.
    // group questions by theme, preserving bank order
    const order = [];
    qs.forEach(q => { if (!order.includes(q.theme)) order.push(q.theme); });
    const body = order.map(th => {
      const items = qs.filter(q => q.theme === th);
      const thTh = (items[0] && items[0].themeTh) || '';
      const rows = items.map((q, i) => {
        const saved = ans[q.questionId] || {};
        if (q.type === 'open') {
          return `<div class="m3-card m3-card-pad" style="margin-bottom:8px"><div style="font-size:14px;line-height:1.5;margin-bottom:6px">${esc(q.text)}</div>
            <textarea class="m3-textarea" data-o="${esc(q.questionId)}" rows="2" placeholder="ความคิดเห็น (ไม่บังคับ)">${esc(saved.openText || '')}</textarea></div>`;
        }
        return `<div class="m3-card m3-card-pad" data-qwrap="${esc(q.questionId)}" style="margin-bottom:8px"><div style="font-size:14px;line-height:1.5">${esc(q.text)}</div>${ratingRow('q_' + q.questionId, saved.score, d.scaleLabels)}</div>`;
      }).join('');
      return `<div class="m3-section-label" style="margin-top:14px">${esc(th || 'ทั่วไป')}${thTh ? ' · ' + esc(thTh) : ''}</div>${rows}`;
    }).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">${heading}</h2><p class="m3-eyebrow">${RELATION_MY[a.relation].label} · เลือกคะแนน 1-5 ทุกข้อ${a.done ? ' · แก้ไขคำตอบได้' : ''}</p></section>
      <section class="m3-section">${body}</section>
      <section class="m3-section"><button type="button" class="m3-btn" id="fbSubmit">${mi('send')}${a.done ? 'บันทึกการแก้ไข' : 'ส่งแบบประเมิน'}</button>
      <p class="m3-save-hint" style="text-align:left">คำตอบเป็นความลับ · ผู้ถูกประเมินไม่เห็นว่าใครให้คะแนน</p></section>
      <div style="height:40px"></div>`, bar('แบบประเมิน')));
    NT.wireM3Nav({ back: () => paintMyFeedback() });
    document.getElementById('fbSubmit').addEventListener('click', submitFeedback);
  }

  async function submitFeedback() {
    const d = fstate.data, qs = d.questions || [];
    const answers = [];
    let missing = 0;
    qs.forEach(q => {
      if (q.type === 'open') {
        const el = document.querySelector(`[data-o="${cssEsc(q.questionId)}"]`);
        const txt = el ? el.value.trim() : '';
        if (txt) answers.push({ questionId: q.questionId, openText: txt });
      } else {
        const sel = document.querySelector(`input[name="q_${cssEsc(q.questionId)}"]:checked`);
        if (sel) answers.push({ questionId: q.questionId, score: Number(sel.value) });
        else missing++;
      }
    });
    if (missing) {
      NT.toast(`ยังให้คะแนนไม่ครบ (เหลือ ${missing} ข้อ)`, 'error');
      // scroll to first unanswered rating
      for (const q of qs) {
        if (q.type === 'open') continue;
        if (!document.querySelector(`input[name="q_${cssEsc(q.questionId)}"]:checked`)) {
          const el = document.querySelector(`[data-qwrap="${cssEsc(q.questionId)}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
      return;
    }
    const btn = document.getElementById('fbSubmit');
    const restore = NT.busyButton(btn, 'กำลังส่ง...');
    try {
      await NT.api('/360/submit', { assignmentId: fstate.assignmentId, answers });
      NT.toast('ส่งแบบประเมินแล้ว ขอบคุณครับ');
      await renderMyFeedback();
    } catch (e) { restore(); NT.toast(e.message, 'error'); }
  }

  // Escape a question id for use inside a CSS attribute/name selector (ids are like "self-01" / "peer-xQ123").
  function cssEsc(s) { return String(s).replace(/["\\\]]/g, '\\$&'); }

  // ============================================================================
  // Phase D (D1) — HR-facing reports: per-person gap, ORG climate, settings.
  // Gaps at theme level; weights + min-responders come from the backend (app_settings).
  // ============================================================================
  const fmt = v => (v == null ? '—' : Number(v).toFixed(2));
  const RREL = { self: 'ตนเอง', peer: 'เพื่อนร่วมงาน', boss: 'หัวหน้า' };

  const rstate = { cycleId: null, data: null };
  async function renderReports(cycleId) {
    rstate.cycleId = cycleId;
    NT.render(NT.m3Shell('profile', loadingBody(), bar('รายงาน Gap 360')));
    NT.wireM3Nav({ back: () => paint() });
    try { rstate.data = await NT.api('/360/report/overview', cycleId ? { cycleId } : {}); paintReports(); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('รายงาน Gap 360')));
      NT.wireM3Nav({ back: () => paint() });
    }
  }
  function paintReports() {
    const d = rstate.data, cycles = d.cycles || [], subs = d.subjects || [];
    const cur = cycles.find(c => c.cycleId === d.cycleId);
    const picker = cycles.length > 1
      ? `<select class="m3-select" id="rCycle" style="margin-bottom:10px">${cycles.map(c => `<option value="${esc(c.cycleId)}"${c.cycleId === d.cycleId ? ' selected' : ''}>ปี ${c.year} · ${c.period}${c.status !== 'draft' ? ' (' + esc(c.status) + ')' : ''}</option>`).join('')}</select>`
      : '';
    const cards = subs.map(s => {
      const thin = s.peer < d.minN && s.boss < d.minN;
      return `<button type="button" class="m3-card m3-card-pad pcard" data-rsub="${esc(s.id)}" data-name="${esc((s.name + ' ' + s.department).toLowerCase())}" style="width:100%;text-align:left;background:none;display:flex;align-items:center;gap:12px;margin-bottom:8px;border:1px solid var(--m3-outline-variant);cursor:pointer">
        <div style="flex:1;min-width:0"><div class="m3-staff-name">${esc(s.name)}</div><div class="m3-staff-role">${esc(s.department || '-')} · เพื่อน ${s.peer} · หัวหน้า ${s.boss}${thin ? ' · ⚠️ ผู้ตอบน้อย' : ''}</div></div>
        ${s.reportStatus === 'released' ? '<span class="m3-badge m3-badge--ok" style="flex:none">เผยแพร่แล้ว</span>' : s.reportStatus ? '<span class="m3-badge" style="flex:none">ร่าง</span>' : mi('chevron_right')}
      </button>`;
    }).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">รายงาน Gap รายบุคคล</h2><p class="m3-eyebrow">${cur ? 'ปี ' + cur.year + ' · ' + cur.period : 'ยังไม่มีรอบ'} · เทียบ ตนเอง/เพื่อน/หัวหน้า ต่อหมวด</p></section>
      <section class="m3-section">${picker}${subs.length ? searchBox('ค้นหาชื่อ / แผนก') + cards : '<div class="m3-empty">ยังไม่มีใครถูกประเมิน (ต้องมีพนักงานตอบก่อน)</div>'}</section>
      <div style="height:30px"></div>`, bar('รายงาน Gap 360')));
    NT.wireM3Nav({ back: () => paint() });
    const cyc = document.getElementById('rCycle'); if (cyc) cyc.addEventListener('change', () => renderReports(cyc.value));
    wireSearch();
    document.querySelectorAll('[data-rsub]').forEach(b => b.addEventListener('click', () => renderSubjectReport(d.cycleId, b.dataset.rsub)));
  }

  const srstate = { cycleId: null, subjectId: null, data: null };
  async function renderSubjectReport(cycleId, subjectId) {
    srstate.cycleId = cycleId; srstate.subjectId = subjectId;
    NT.render(NT.m3Shell('profile', loadingBody(), bar('รายงาน Gap')));
    NT.wireM3Nav({ back: () => paintReports() });
    try { srstate.data = await NT.api('/360/report/subject', { cycleId, subjectId }); paintSubjectReport(); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('รายงาน Gap')));
      NT.wireM3Nav({ back: () => paintReports() });
    }
  }
  function themeCard(t) {
    const pct = t.overall == null ? 0 : Math.round(t.overall / 5 * 100);
    const gap = (t.gap == null || Math.abs(t.gap) < 0.5) ? '' : `<span class="m3-badge ${t.gap > 0 ? 'm3-badge--warn' : ''}" style="flex:none">${t.gap > 0 ? 'มองตนเองสูงกว่า' : 'ผู้อื่นมองสูงกว่า'} ${Math.abs(t.gap).toFixed(1)}</span>`;
    return `<div class="m3-card m3-card-pad" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div class="m3-staff-name" style="font-size:14px">${esc(t.themeTh || t.theme)}</div>${gap}</div>
      <div class="m3-progress" style="margin:8px 0 6px"><div class="m3-progress-bar" style="width:${pct}%"></div></div>
      <div class="m3-staff-role" style="display:flex;gap:12px;flex-wrap:wrap"><span>ตนเอง ${fmt(t.self)}</span><span>เพื่อน ${fmt(t.peer)}</span><span>หัวหน้า ${fmt(t.boss)}</span><span>รวม <strong>${fmt(t.overall)}</strong></span></div>
    </div>`;
  }
  function paintSubjectReport() {
    const d = srstate.data, s = d.subject, thin = d.counts.peer < d.minN && d.counts.boss < d.minN;
    const themeCards = (d.themes || []).length ? d.themes.map(themeCard).join('') : '<div class="m3-empty">ยังไม่มีคะแนน</div>';
    const commentGroups = ['self', 'peer', 'boss'].map(rel => {
      const items = (d.comments || []).filter(c => c.rel === rel);
      if (!items.length) return '';
      return `<div class="m3-section-label" style="margin-top:12px">${RREL[rel]} (${items.length})</div>${items.map(c => `<div class="m3-card m3-card-pad" style="margin-bottom:6px;font-size:14px;line-height:1.5">${esc(c.text)}</div>`).join('')}`;
    }).join('');
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">${esc(s.name)}</h2><p class="m3-eyebrow">${esc(s.department || '-')} · เพื่อน ${d.counts.peer} · หัวหน้า ${d.counts.boss} คน${thin ? ' · ⚠️ ผู้ตอบน้อยกว่าขั้นต่ำ (' + d.minN + ')' : ''}</p></section>
      <section class="m3-section"><h3 class="m3-section-label">คะแนนต่อหมวด (Gap)</h3>${themeCards}</section>
      ${commentGroups ? `<section class="m3-section"><h3 class="m3-section-label">ความคิดเห็น (ไม่ระบุผู้ตอบ)</h3>${commentGroups}</section>` : ''}
      <section class="m3-section"><h3 class="m3-section-label">สรุปสำหรับพนักงาน (HR แก้ไขได้)</h3>
        <div class="m3-card m3-card-pad" style="background:${d.status === 'released' ? 'var(--m3-primary-fixed)' : 'var(--m3-surface-lowest)'};padding:10px 12px;margin-bottom:8px"><span class="m3-staff-role">${d.status === 'released' ? mi('visibility') + ' เผยแพร่แล้ว — พนักงานเห็นรายงานนี้' : mi('visibility_off') + ' ร่าง — พนักงานยังไม่เห็น'}</span></div>
        <p class="m3-save-hint" style="text-align:left;margin:0 0 6px">ระบบร่างให้จากคะแนน · ปรับถ้อยคำก่อนเผยแพร่ (เน้นคำ + แนวทางพัฒนา)</p>
        <textarea class="m3-textarea" id="rSummary" rows="6">${esc(d.finalSummary || d.draftSummary || '')}</textarea>
        <button type="button" class="m3-btn m3-btn--ghost" id="rUseDraft" style="margin-top:8px">${mi('auto_awesome')}ใช้ร่างที่ระบบสร้าง</button>
        <button type="button" class="m3-btn m3-btn--ghost" id="rSave" style="margin-top:8px">${mi('save')}บันทึกร่าง</button>
        ${d.status === 'released'
        ? `<button type="button" class="m3-btn m3-btn--ghost" id="rUnrelease" style="margin-top:8px;color:var(--m3-error)">${mi('visibility_off')}ยกเลิกเผยแพร่</button>`
        : `<button type="button" class="m3-btn" id="rRelease" style="margin-top:8px">${mi('send')}เผยแพร่ให้พนักงาน</button>`}
      </section>
      <div style="height:40px"></div>`, bar('รายงาน Gap')));
    NT.wireM3Nav({ back: () => paintReports() });
    document.getElementById('rUseDraft').addEventListener('click', () => { document.getElementById('rSummary').value = d.draftSummary || ''; });
    document.getElementById('rSave').addEventListener('click', e => saveReport('draft', e.currentTarget));
    const rel = document.getElementById('rRelease'); if (rel) rel.addEventListener('click', async e => { if (await NT.confirmSheet({ title: 'เผยแพร่ให้พนักงาน?', desc: 'พนักงานจะเห็นรายงานของตัวเอง (คะแนนกลุ่มเล็กกว่าขั้นต่ำจะถูกซ่อน)', confirmLabel: 'เผยแพร่' })) saveReport('released', e.currentTarget); });
    const unr = document.getElementById('rUnrelease'); if (unr) unr.addEventListener('click', e => saveReport('draft', e.currentTarget));
  }
  async function saveReport(status, btn) {
    const finalSummary = document.getElementById('rSummary').value;
    const restore = NT.busyButton(btn, 'กำลังบันทึก...');
    try {
      await NT.api('/360/report/save', { cycleId: srstate.cycleId, subjectId: srstate.subjectId, finalSummary, draftSummary: srstate.data.draftSummary || '', status });
      NT.toast(status === 'released' ? 'เผยแพร่ให้พนักงานแล้ว' : 'บันทึกแล้ว');
      await renderSubjectReport(srstate.cycleId, srstate.subjectId);
    } catch (e) { restore(); NT.toast(e.message, 'error'); }
  }

  const clstate = { data: null };
  async function renderClimate(cycleId) {
    NT.render(NT.m3Shell('profile', loadingBody(), bar('บรรยากาศองค์กร')));
    NT.wireM3Nav({ back: () => paint() });
    try { clstate.data = await NT.api('/360/report/climate', cycleId ? { cycleId } : {}); paintClimate(); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('บรรยากาศองค์กร')));
      NT.wireM3Nav({ back: () => paint() });
    }
  }
  function paintClimate() {
    const d = clstate.data;
    const bars = (d.themes || []).length ? d.themes.map(t => {
      const pct = Math.round(t.avg / 5 * 100);
      return `<div class="m3-card m3-card-pad" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:8px"><div class="m3-staff-name" style="font-size:14px">${esc(t.themeTh || t.theme)}</div><strong>${fmt(t.avg)}</strong></div>
        <div class="m3-progress" style="margin-top:8px"><div class="m3-progress-bar" style="width:${pct}%"></div></div></div>`;
    }).join('') : '<div class="m3-empty">ยังไม่มีคะแนน ORG</div>';
    const comments = (d.comments || []).length ? d.comments.map(c => `<div class="m3-card m3-card-pad" style="margin-bottom:6px;font-size:14px;line-height:1.5">${esc(c)}</div>`).join('') : '';
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">บรรยากาศองค์กร (ORG)</h2><p class="m3-eyebrow">ภาพรวมทั้งองค์กร · ผู้ตอบ ${d.responders || 0} คน (ไม่ระบุตัวตน)</p></section>
      <section class="m3-section">${bars}</section>
      ${comments ? `<section class="m3-section"><h3 class="m3-section-label">ความคิดเห็นต่อองค์กร</h3>${comments}</section>` : ''}
      <div style="height:30px"></div>`, bar('บรรยากาศองค์กร')));
    NT.wireM3Nav({ back: () => paint() });
  }

  // Aggregate rollup — whole org or one department (aggregate-only, reuses themeCard).
  const gstate = { cycleId: null, department: null, data: null };
  async function renderGroupReport(cycleId, department) {
    gstate.cycleId = cycleId; gstate.department = department;
    NT.render(NT.m3Shell('profile', loadingBody(), bar('รายงานรวม 360')));
    NT.wireM3Nav({ back: () => paint() });
    try {
      const body = {}; if (cycleId) body.cycleId = cycleId; if (department) body.department = department;
      gstate.data = await NT.api('/360/report/group', body);
      paintGroupReport();
    } catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('รายงานรวม 360')));
      NT.wireM3Nav({ back: () => paint() });
    }
  }
  function paintGroupReport() {
    const d = gstate.data, cycles = d.cycles || [], depts = d.departments || [];
    const cyc = cycles.find(c => c.cycleId === d.cycleId);
    const cyclePicker = cycles.length > 1
      ? `<select class="m3-select" id="gCycle" style="margin-bottom:8px">${cycles.map(c => `<option value="${esc(c.cycleId)}"${c.cycleId === d.cycleId ? ' selected' : ''}>ปี ${c.year} · ${c.period}</option>`).join('')}</select>` : '';
    const deptPicker = `<select class="m3-select" id="gDept" style="margin-bottom:10px"><option value=""${!d.department ? ' selected' : ''}>ทั้งองค์กร</option>${depts.map(dep => `<option value="${esc(dep)}"${d.department === dep ? ' selected' : ''}>${esc(dep)}</option>`).join('')}</select>`;
    const themeCards = (d.themes || []).length ? d.themes.map(themeCard).join('') : '<div class="m3-empty">ยังไม่มีคะแนน</div>';
    const climate = (d.climate || []).length ? d.climate.map(t => {
      const pct = Math.round(t.avg / 5 * 100);
      return `<div class="m3-card m3-card-pad" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;gap:8px"><div class="m3-staff-name" style="font-size:14px">${esc(t.themeTh || t.theme)}</div><strong>${fmt(t.avg)}</strong></div><div class="m3-progress" style="margin-top:8px"><div class="m3-progress-bar" style="width:${pct}%"></div></div></div>`;
    }).join('') : '';
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">รายงานรวม 360</h2><p class="m3-eyebrow">${cyc ? 'ปี ' + cyc.year + ' · ' + cyc.period : ''} · ${d.department ? esc(d.department) : 'ทั้งองค์กร'} · ${d.subjectCount} คน</p></section>
      <section class="m3-section">${cyclePicker}${deptPicker}</section>
      <section class="m3-section"><h3 class="m3-section-label">คะแนนรวมต่อหมวด (ตนเอง/เพื่อน/หัวหน้า)</h3>${themeCards}</section>
      ${climate ? `<section class="m3-section"><h3 class="m3-section-label">บรรยากาศองค์กร (ORG · ${d.climateResponders} คนตอบ)</h3>${climate}</section>` : ''}
      <div style="height:30px"></div>`, bar('รายงานรวม 360')));
    NT.wireM3Nav({ back: () => paint() });
    const gc = document.getElementById('gCycle'); if (gc) gc.addEventListener('change', () => renderGroupReport(gc.value, gstate.department));
    document.getElementById('gDept').addEventListener('change', e => renderGroupReport(d.cycleId, e.currentTarget.value || null));
  }

  async function renderSettings() {
    NT.render(NT.m3Shell('profile', loadingBody(), bar('ตั้งค่า 360')));
    NT.wireM3Nav({ back: () => paint() });
    let w = { boss: 0.4, peer: 0.4, self: 0.2 }, minN = 3, cutoff = 14, caps = SCALE_360_DEFAULT.slice();
    try {
      const d = await NT.api('/360/report/overview', {});
      w = d.weights || w; minN = d.minN || minN;
      if (d.cutoffDays != null) cutoff = d.cutoffDays;
      if (Array.isArray(d.scaleLabels)) caps = scaleCaps(d.scaleLabels).map(s => s.cap);
    } catch (e) { /* use defaults */ }
    NT.render(NT.m3Shell('profile', `
      <section class="m3-section" style="gap:4px"><h2 class="m3-title">ตั้งค่ารายงาน 360</h2><p class="m3-eyebrow">น้ำหนักใช้ตอนรวมคะแนน gap · ผู้ตอบขั้นต่ำใช้กันระบุตัวตน</p></section>
      <form id="stForm" class="m3-section">
        <label class="m3-elabel">น้ำหนัก หัวหน้า (BOSS)</label><input class="m3-input" type="number" name="boss" step="0.05" min="0" max="1" value="${w.boss}" inputmode="decimal" required>
        <label class="m3-elabel">น้ำหนัก เพื่อนร่วมงาน (PEER)</label><input class="m3-input" type="number" name="peer" step="0.05" min="0" max="1" value="${w.peer}" inputmode="decimal" required>
        <label class="m3-elabel">น้ำหนัก ตนเอง (SELF)</label><input class="m3-input" type="number" name="self" step="0.05" min="0" max="1" value="${w.self}" inputmode="decimal" required>
        <p class="m3-save-hint" style="text-align:left">ค่ามาตรฐาน 0.4 / 0.4 / 0.2 · ระบบ normalize ให้เองเวลาบางแกนไม่มีข้อมูล</p>
        <label class="m3-elabel">ผู้ตอบขั้นต่ำต่อแกน (min responders)</label><input class="m3-input" type="number" name="minResponses" step="1" min="1" value="${minN}" inputmode="numeric" required>
        <label class="m3-elabel">cutoff คนเข้าใหม่ (วัน · 0 = ปิด)</label><input class="m3-input" type="number" name="joinCutoffDays" step="1" min="0" value="${cutoff}" inputmode="numeric" required>
        <p class="m3-save-hint" style="text-align:left">พนักงานที่เริ่มงานหลัง "วันเริ่มรอบ + N วัน" จะไม่ถูกจับคู่ในรอบนี้ (รอรอบหน้า) · ใช้เมื่อรอบมีวันเริ่ม</p>
        <div class="m3-elabel" style="margin-top:18px">คำอธิบายปุ่มให้คะแนน (1-5)</div>
        <p class="m3-save-hint" style="text-align:left;margin-top:0">คำที่ขึ้นใต้ตัวเลขในแบบประเมิน · เว้นว่าง = ใช้คำมาตรฐาน · <strong>ไม่กระทบคะแนนที่เก็บไว้</strong> (คะแนนคือตัวเลข คำเป็นแค่ป้าย)</p>
        ${caps.map((c, i) => `<label class="m3-elabel">${i + 1} =</label><input class="m3-input" name="cap${i + 1}" value="${esc(c)}" maxlength="24" placeholder="${esc(SCALE_360_DEFAULT[i])}">`).join('')}
        <button type="button" class="m3-btn m3-btn--ghost" id="stCapReset" style="margin-top:8px">${mi('restart_alt')}ใช้คำมาตรฐาน</button>
        <button type="submit" class="m3-btn" style="margin-top:16px">${mi('save')}บันทึกตั้งค่า</button>
      </form><div style="height:30px"></div>`, bar('ตั้งค่า 360')));
    NT.wireM3Nav({ back: () => paint() });
    document.getElementById('stCapReset').addEventListener('click', () => {
      SCALE_360_DEFAULT.forEach((d, i) => { document.querySelector(`[name="cap${i + 1}"]`).value = d; });
      NT.toast('ใส่คำมาตรฐานให้แล้ว · กดบันทึกเพื่อยืนยัน', 'info');
    });
    document.getElementById('stForm').addEventListener('submit', async e => {
      e.preventDefault();
      const restore = NT.busyButton(e.currentTarget.querySelector('button[type="submit"]'), 'กำลังบันทึก...');
      try {
        const f = Object.fromEntries(new FormData(e.currentTarget).entries());
        f.scaleLabels = [f.cap1, f.cap2, f.cap3, f.cap4, f.cap5];
        await NT.api('/360/settings/save', f);
        NT.toast('บันทึกตั้งค่าแล้ว');
        paint();
      } catch (err) { restore(); NT.toast(err.message, 'error'); }
    });
  }

  // D2 — employee views their OWN released report (min-N already applied server-side).
  async function renderMyReport() {
    NT.render(NT.m3Shell('profile', loadingBody(), bar('ผลประเมิน 360 ของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    try { const d = await NT.api('/360/my/report', {}); paintMyReport(d.reports || []); }
    catch (e) {
      NT.render(NT.m3Shell('profile', `<section class="m3-section"><div class="m3-card m3-card-pad">${mi('error')} ${esc(e.message || '')}</div></section>`, bar('ผลประเมิน 360 ของฉัน')));
      NT.wireM3Nav({ back: () => NT.goPortal() });
    }
  }
  // V2 pilot screen — editorial, restrained, "letter" summary + two-dot gap track + spring entrance.
  const periodTh = p => p === 'H1' ? 'ครึ่งปีแรก' : p === 'H2' ? 'ครึ่งปีหลัง' : (p || '');
  function paintMyReport(reports) {
    if (!reports.length) {
      NT.render(NT.m3Shell('profile', `<div class="v2"><div class="v2empty">${mi('hourglass_empty')}<div style="margin-top:8px;font-size:15px;color:#33453b">ยังไม่มีผลที่เผยแพร่</div><div style="font-size:12px;margin-top:4px">เมื่อ HR สรุปและเผยแพร่ คุณจะเห็นผลของตัวเองที่นี่</div></div></div>`, bar('ผลประเมิน 360° ของฉัน')));
      NT.wireM3Nav({ back: () => NT.goPortal() });
      NT.wirePTR(refreshMyReport);
      return;
    }
    const blocks = reports.map((r, ri) => {
      const rated = (r.themes || []).filter(t => t.overall != null);
      const strong = rated.length ? [...rated].sort((a, b) => b.overall - a.overall)[0] : null;
      const weak = rated.length ? [...rated].sort((a, b) => a.overall - b.overall)[0] : null;
      const c = r.counts || {};
      const note = r.summary ? `<div class="v2note v2anim" style="animation-delay:.06s"><span class="qm">&rdquo;</span><span class="v2tag">สรุปจาก HR</span><p>${esc(r.summary)}</p></div>` : '';
      const pills = (strong || weak) ? `<div class="v2pills v2anim" style="animation-delay:.1s;margin-top:14px">
        ${strong ? `<div class="v2pill"><div class="k">${mi('trending_up')}จุดแข็ง</div><div class="val">${esc(strong.themeTh || strong.theme)}</div></div>` : ''}
        ${weak && weak !== strong ? `<div class="v2pill dev"><div class="k">${mi('auto_awesome')}ควรพัฒนา</div><div class="val">${esc(weak.themeTh || weak.theme)}</div></div>` : ''}
      </div>` : '';
      const rows = (r.themes || []).map(t => {
        const others = [t.peer, t.boss].filter(v => v != null);
        const oth = others.length ? others.reduce((a, b) => a + b, 0) / others.length : null;
        const gap = (t.self != null && oth != null) ? Math.abs(t.self - oth) : null;
        const fillPct = t.overall != null ? Math.round(t.overall / 5 * 100) : 0;
        const dots = `${oth != null ? `<div class="dot oth" style="left:${Math.round(oth / 5 * 100)}%"></div>` : ''}${t.self != null ? `<div class="dot self" style="left:${Math.round(t.self / 5 * 100)}%"></div>` : ''}`;
        return `<div class="v2th"><div class="top"><span class="nm">${esc(t.themeTh || t.theme)}${gap != null && gap >= 0.5 ? `<span class="v2gap">มองต่าง ${gap.toFixed(1)}</span>` : ''}</span><span class="vv">${t.overall != null ? t.overall.toFixed(1) : '—'}</span></div>${t.overall != null ? `<div class="v2track"><div class="fill" style="width:${fillPct}%"></div>${dots}</div>` : ''}</div>`;
      }).join('');
      const hiddenNote = (r.hidden && (r.hidden.peer || r.hidden.boss)) ? `<div class="v2sub" style="margin-top:8px">* บางกลุ่มมีผู้ตอบน้อยกว่า ${r.minN} คน จึงซ่อนไว้เพื่อรักษาความลับของผู้ตอบ</div>` : '';
      const themeSec = rated.length ? `<div class="v2anim" style="margin-top:26px;animation-delay:.14s">
        <div class="v2sechead"><h2 class="v2sec">คะแนนต่อหมวด</h2><div class="v2legend"><span><i class="l-oth"></i>ผู้อื่น</span><span><i class="l-self"></i>ตนเอง</span></div></div>
        <div class="v2card">${rows}</div>${hiddenNote}</div>` : '';
      const cmts = (r.comments || []).length ? `<div class="v2anim" style="margin-top:26px;animation-delay:.18s"><h2 class="v2sec" style="margin:0 2px 8px">เสียงจากทีม</h2>${['self', 'peer', 'boss'].map(rel => (r.comments || []).filter(x => x.rel === rel).map(x => `<div class="v2cmt" style="margin-top:8px"><div class="who">${RREL[rel]}</div>${esc(x.text)}</div>`).join('')).join('')}</div>` : '';
      return `<div class="v2eyebrow v2anim">${periodTh(r.period)} · ${r.year}</div>
        ${ri === 0 ? `<h1 class="v2title v2anim" style="animation-delay:.02s">ผลของคุณ</h1>` : ''}
        <div class="v2sub v2anim" style="animation-delay:.04s">ประเมินโดยเพื่อนร่วมงาน ${c.peer || 0} คน และหัวหน้า ${c.boss || 0} คน · ไม่ระบุตัวผู้ให้คะแนน</div>
        ${note ? `<div style="margin-top:18px">${note}</div>` : ''}${pills}${themeSec}${cmts}
        ${ri < reports.length - 1 ? '<div style="height:34px"></div>' : ''}`;
    }).join('');
    NT.render(NT.m3Shell('profile', `<div class="v2">${blocks}<div style="height:40px"></div></div>`, bar('ผลประเมิน 360° ของฉัน')));
    NT.wireM3Nav({ back: () => NT.goPortal() });
    NT.wirePTR(refreshMyReport);
  }
  async function refreshMyReport() {
    try { const d = await NT.api('/360/my/report', {}); paintMyReport(d.reports || []); NT.haptic(); }
    catch (e) { NT.toast(e.message, 'error'); }
  }

  window.FB360 = { renderHome, renderMyFeedback, renderMyReport };
})();
