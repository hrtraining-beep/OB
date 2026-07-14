// ============================================================================
// 360° Feedback System — backend handlers (see PROJECT_360.md + HANDOFF_M3.md)
// ----------------------------------------------------------------------------
// RULES (cross-session discipline): ADDITIVE only; shared helpers via `ctx`; never touch worker.js
// internals; new tables use CREATE TABLE IF NOT EXISTS; routes namespaced under /360/*.
// North star: output = gap + WORDS (development guidance), not numbers alone.
// Phase A (this file): cycles + question bank (seed all 60 Qs from the HR xlsx, CMS-editable).
// ============================================================================

// Theme English key → Thai label. People axes (self/peer/boss) share 5 themes; ORG uses its own 6.
const THEME_TH = {
  "Organization Alignment": "การปฏิบัติงานให้สอดคล้องกับองค์กร",
  "Accountability & Execution": "ความรับผิดชอบ และการส่งมอบงาน",
  "Collaboration & Communication": "การทำงานร่วมกัน และการสื่อสาร",
  "Development and Problem Solving": "การพัฒนา และการแก้ปัญหา",
  "Integrity & Professionalism": "ความซื่อสัตย์ และความเป็นมืออาชีพ",
  "Accountability": "ความรับผิดชอบและการส่งมอบงาน",
  "Collaboration": "การทำงานร่วมกันและการสื่อสาร",
  "Growth & Problem-Solving": "การพัฒนาตนเองและการแก้ปัญหา",
  "Recognition & Employee Experience": "การสร้างแรงจูงใจ และประสบการณ์พนักงาน",
  "Trust & Integrity": "ความไว้วางใจ และความเป็นมืออาชีพ",
  "Additional comment": "ความคิดเห็นเพิ่มเติม"
};

// Full question bank from 360_Question_Revised (HR Mng.).xlsx — verbatim, no truncation.
// Each row: [relation_type, theme, question_type, question_text]. sort_order = position in its axis.
const SEED_QUESTIONS = {
  self: [
    ["Organization Alignment", "rating", "ข้าพเจ้าเข้าใจเป้าหมาย และทิศทางขององค์กรอย่างชัดเจน"],
    ["Organization Alignment", "rating", "ข้าพเจ้าตระหนักถึงบทบาท และความรับผิดชอบของตนเองในองค์กร"],
    ["Organization Alignment", "rating", "ข้าพเจ้าปรับตัวตามการเปลี่ยนแปลงขององค์กรได้อย่างเหมาะสม"],
    ["Accountability & Execution", "rating", "ข้าพเจ้ารับผิดชอบต่องาน และส่งมอบงานตามเวลาที่กำหนด"],
    ["Accountability & Execution", "rating", "ข้าพเจ้าปฏิบัติตามระเบียบ ขั้นตอน และมาตรฐานการทำงาน (SOP) ขององค์กร"],
    ["Accountability & Execution", "rating", "ข้าพเจ้าติดตามงานจนแล้วเสร็จ และรับผิดชอบต่อผลลัพธ์ของงาน"],
    ["Accountability & Execution", "rating", "ข้าพเจ้าบริหารเวลา และลำดับความสำคัญของงานได้อย่างเหมาะสม"],
    ["Collaboration & Communication", "rating", "ข้าพเจ้าสื่อสารกับผู้อื่นได้อย่างชัดเจน และเหมาะสม"],
    ["Collaboration & Communication", "rating", "ข้าพเจ้าทำงานร่วมกับผู้อื่นได้อย่างมีประสิทธิภาพ"],
    ["Collaboration & Communication", "rating", "ข้าพเจ้ารับฟังความคิดเห็น และเคารพความคิดเห็นของผู้อื่น"],
    ["Collaboration & Communication", "rating", "ข้าพเจ้าสร้างความร่วมมือระหว่างทีม และหน่วยงานที่เกี่ยวข้องในการทำงานร่วมกัน ให้ดำเนินไปได้อย่างราบรื่น"],
    ["Collaboration & Communication", "rating", "ข้าพเจ้าจัดการความขัดแย้ง หรือความเห็นต่างในการทำงานได้อย่างเหมาะสม โดยไม่ส่งผลกระทบต่อความสัมพันธ์ในการทำงาน"],
    ["Development and Problem Solving", "rating", "ข้าพเจ้าสามารถวิเคราะห์ และแก้ไขปัญหาในการทำงานได้อย่างเหมาะสม"],
    ["Development and Problem Solving", "rating", "ข้าพเจ้าเสนอแนวทางปรับปรุงงานบนพื้นฐานของข้อมูล และเหตุผล"],
    ["Development and Problem Solving", "rating", "ข้าพเจ้าพร้อมเรียนรู้ และปรับต่อการเปลี่ยนแปลง เมื่อพบอุปสรรค และข้อจำกัด"],
    ["Development and Problem Solving", "rating", "ข้าพเจ้าพัฒนาความรู้ และทักษะอย่างต่อเนื่อง"],
    ["Integrity & Professionalism", "rating", "ข้าพเจ้าปฏิบัติตามกฎระเบียบ และมาตรฐานขององค์กรอย่างเคร่งครัด"],
    ["Integrity & Professionalism", "rating", "ข้าพเจ้ารักษาความลับ และข้อมูลของผู้อื่น และองค์กรอย่างเหมาะสม"],
    ["Integrity & Professionalism", "rating", "ข้าพเจ้าปฏิบัติงานด้วยความซื่อสัตย์ และมีจริยธรรม ทำในสิ่งที่ถูกต้อง"],
    ["Integrity & Professionalism", "rating", "ข้าพเจ้าเคารพผู้อื่น และปฏิบัติตนอย่างมืออาชีพ รวมถึงเป็นแบบอย่างที่ดี"],
    ["Additional comment", "open", "สิ่งใด คือจุดแข็งของข้าพเจ้าที่ส่งผลให้งานสำเร็จได้ดี"],
    ["Additional comment", "open", "สิ่งใดที่ข้าพเจ้าควรพัฒนา (เพิ่มเติม) เพื่อให้ทำงานได้มีประสิทธิภาพมากขึ้น"]
  ],
  peer: [
    ["Accountability & Execution", "rating", "ผู้ถูกประเมินส่งมอบงาน หรือข้อมูลที่เกี่ยวข้องกับท่านได้ครบถ้วน และตรงเวลา"],
    ["Accountability & Execution", "rating", "ผู้ถูกประเมินปฏิบัติตามขั้นตอน รักษามาตรฐาน และคุณภาพของงานที่ส่งต่อให้ท่าน"],
    ["Accountability & Execution", "rating", "ผู้ถูกประเมินติดตามงานจนแล้วเสร็จ และรับผิดชอบต่อผลลัพธ์ของงาน"],
    ["Collaboration & Communication", "rating", "ผู้ถูกประเมินมีการสื่อสารที่ดี กับท่านได้อย่างชัดเจน และตรงประเด็น"],
    ["Collaboration & Communication", "rating", "ผู้ถูกประเมินรับฟังความคิดเห็น และเคารพความคิดเห็นของผู้อื่น"],
    ["Collaboration & Communication", "rating", "ผู้ถูกประเมินให้ความร่วมมือ และพร้อมช่วยเหลือท่านเมื่อจำเป็น"],
    ["Collaboration & Communication", "rating", "ผู้ถูกประเมินจัดการความเห็นต่างกับท่านได้อย่างเหมาะสม โดยไม่ส่งผลกระทบต่อการทำงานร่วมกัน"],
    ["Development and Problem Solving", "rating", "ผู้ถูกประเมินแสดงให้เห็นถึงความพร้อมในการเรียนรู้ พัฒนา และปรับปรุงการทำงานเมื่อได้รับข้อเสนอแนะจากท่าน"],
    ["Development and Problem Solving", "rating", "ผู้ถูกประเมินสามารถวิเคราะห์ปัญหา และหาแนวทางแก้ไขปัญหาในการทำงานได้อย่างเหมาะสม"],
    ["Development and Problem Solving", "rating", "ผู้ถูกประเมินมีส่วนร่วมในการเสนอแนวทางปรับปรุงกระบวนการทำงาน หรือวิธีการทำงานให้มีประสิทธิภาพมากยิ่งขึ้น"],
    ["Integrity & Professionalism", "rating", "ผู้ถูกประเมินปฏิบัติตามกฎระเบียบตามหน่วยงานต่าง ๆ รวมถึงองค์กร"],
    ["Integrity & Professionalism", "rating", "ผู้ถูกประเมินรักษาความลับของผู้อื่น และองค์กร"],
    ["Integrity & Professionalism", "rating", "ผู้ถูกประเมินปฏิบัติงานด้วยความซื่อสัตย์ และมีจริยธรรม ทำในสิ่งที่ถูกต้อง"],
    ["Integrity & Professionalism", "rating", "ผู้ถูกประเมินเคารพผู้อื่น และปฏิบัติตนอย่างมืออาชีพ"],
    ["Additional comment", "open", "จุดแข็งของผู้ถูกประเมินในการทำงานร่วมกับท่านคืออะไร"],
    ["Additional comment", "open", "สิ่งใดที่ผู้ถูกประเมินควรปรับปรุงเพื่อให้การทำงานร่วมกับท่านมีประสิทธิภาพมากขึ้น"]
  ],
  boss: [
    ["Organization Alignment", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) สามารถกำหนดทิศทาง เป้าหมาย และความคาดหวังในการทำงานให้ท่านเข้าใจได้อย่างชัดเจน"],
    ["Organization Alignment", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) เป็นแบบอย่างที่ดีในการปฏิบัติงาน และส่งเสริมให้ทีมงานปฏิบัติตามมาตรฐานขององค์กร"],
    ["Accountability & Execution", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) ให้ Feedback กับท่านอย่างตรงไปตรงมา ชัดเจน และสร้างสรรค์"],
    ["Accountability & Execution", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) พิจารณาเรื่องต่าง ๆ โดยยึดหลักเหตุผล ความถูกต้อง และความเป็นธรรม"],
    ["Collaboration & Communication", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) รับฟังความคิดเห็น และเปิดโอกาสให้ท่านแสดงความคิดเห็นได้อย่างเหมาะสม"],
    ["Collaboration & Communication", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) ปฏิบัติต่อสมาชิกในทีมอย่างเท่าเทียม และไม่มีอคติ"],
    ["Collaboration & Communication", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) สร้างบรรยากาศการทำงานที่ส่งเสริมกำลังใจ และสร้างแรงจูงใจให้แก่ทีมงาน"],
    ["Development and Problem Solving", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) ให้คำแนะนำ สนับสนุน และส่งเสริมให้ท่านได้เรียนรู้ พัฒนาทักษะใหม่ ๆ เพื่อการเติบโตในหน้าที่การงาน"],
    ["Development and Problem Solving", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) สร้างความเชื่อมั่น และทำให้ทีมงานกล้าที่จะขอคำปรึกษา หรือพูดคุยเมื่อเกิดปัญหาในการทำงาน"],
    ["Integrity & Professionalism", "rating", "ผู้ถูกประเมิน (หัวหน้างาน) มีความน่าเชื่อถือ รักษาคำพูด และสร้างความไว้วางใจให้แก่ทีมงาน"],
    ["Additional comment", "open", "พฤติกรรมหรือการกระทำใดของผู้ถูกประเมิน (หัวหน้างาน) ที่ช่วยให้ท่านทำงานได้ดี และควรรักษาไว้ต่อไป"],
    ["Additional comment", "open", "สิ่งใดที่ผู้ถูกประเมิน (หัวหน้างาน) ควรปรับปรุง หรือพัฒนาเพิ่มเติม เพื่อสนับสนุนการทำงานของท่าน และทีมได้ดียิ่งขึ้น"]
  ],
  org: [
    ["Organization Alignment", "rating", "องค์กรสื่อสารวิสัยทัศน์ เป้าหมาย และทิศทางการดำเนินงานให้พนักงานเข้าใจได้อย่างชัดเจน"],
    ["Accountability", "rating", "องค์กรมีระบบ ขั้นตอน และมาตรฐานการทำงานที่ช่วยให้สามารถปฏิบัติงานได้อย่างมีประสิทธิภาพ"],
    ["Accountability", "rating", "องค์กรจัดเตรียมทรัพยากร เครื่องมือ และการสนับสนุนที่เพียงพอต่อการปฏิบัติงาน"],
    ["Collaboration", "rating", "บรรยากาศในการทำงานส่งเสริมให้เกิดการทำงานร่วมกันระหว่างหน่วยงาน และเพื่อนร่วมงาน"],
    ["Collaboration", "rating", "องค์กรเปิดโอกาสให้พนักงานสามารถสื่อสาร แสดงความคิดเห็น หรือเสนอแนะแนวทางปรับปรุงได้อย่างเหมาะสม"],
    ["Growth & Problem-Solving", "rating", "องค์กรส่งเสริมให้พนักงานได้เรียนรู้ พัฒนา และมีโอกาสเติบโตในสายอาชีพ"],
    ["Recognition & Employee Experience", "rating", "องค์กรให้ความสำคัญกับการยกย่อง ชื่นชม และดูแลสวัสดิการหรือคุณภาพชีวิตของพนักงานอย่างเหมาะสม"],
    ["Trust & Integrity", "rating", "องค์กรดำเนินธุรกิจด้วยความโปร่งใส ยุติธรรม และสร้างความเชื่อมั่นให้แก่พนักงาน"],
    ["Additional comment", "open", "สิ่งใดขององค์กรที่ช่วยสนับสนุนให้ท่านสามารถทำงานได้อย่างมีประสิทธิภาพ และควรรักษาไว้ต่อไป"],
    ["Additional comment", "open", "สิ่งใดที่องค์กรควรปรับปรุงหรือพัฒนาเพิ่มเติม เพื่อสร้างประสบการณ์การทำงานที่ดีขึ้นแก่พนักงาน"]
  ]
};

async function ensureFb360Tables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feedback_360_cycles (
    cycle_id TEXT PRIMARY KEY,
    cycle_year INTEGER NOT NULL,
    cycle_period TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    start_date TEXT,
    due_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feedback_360_question_bank (
    question_id TEXT PRIMARY KEY,
    relation_type TEXT NOT NULL,
    theme TEXT,
    theme_th TEXT,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'rating',
    sort_order INTEGER,
    active INTEGER NOT NULL DEFAULT 1
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_fb360_q_rel ON feedback_360_question_bank(relation_type)").run();
  // Phase B: assignments (who evaluates whom in a cycle). subject NULL for org axis.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feedback_360_assignments (
    assignment_id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    evaluator_user_id TEXT NOT NULL,
    subject_user_id TEXT,
    relation_type TEXT NOT NULL,
    is_cross_department INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT,
    updated_at TEXT
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_fb360_asg_cycle ON feedback_360_assignments(cycle_id)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_fb360_asg_eval ON feedback_360_assignments(evaluator_user_id)").run();
  // reviewed=1 → HR acknowledged this flagged (cross-department) pair, so it leaves the exception queue.
  try { await env.DB.prepare("ALTER TABLE feedback_360_assignments ADD COLUMN reviewed INTEGER DEFAULT 0").run(); } catch (e) { /* already exists */ }
  // Phase C: responses. theme is denormalized in-row so gap-by-theme queries need no join back
  // to the (per-axis) question bank. score NULL for open questions; open_text NULL for ratings.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feedback_360_responses (
    response_id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    theme TEXT,
    score INTEGER,
    open_text TEXT,
    submitted_at TEXT
  )`).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_fb360_resp_asg ON feedback_360_responses(assignment_id)").run();
  // Phase D: one gap report per (cycle, subject). Theme scores are computed on the fly from
  // responses; only the HR-editable narrative + release state are persisted here.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feedback_360_gap_reports (
    report_id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL,
    subject_user_id TEXT NOT NULL,
    draft_summary TEXT,
    final_summary TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    updated_by TEXT,
    updated_at TEXT
  )`).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_fb360_gap_cs ON feedback_360_gap_reports(cycle_id, subject_user_id)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)").run();
  await seedQuestionBank(env);
}

// Seed the bank once (idempotent via INSERT OR IGNORE keyed by relation+order — HR edits are preserved).
async function seedQuestionBank(env) {
  for (const relation of Object.keys(SEED_QUESTIONS)) {
    const rows = SEED_QUESTIONS[relation];
    for (let i = 0; i < rows.length; i++) {
      const [theme, type, text] = rows[i];
      const qid = `${relation}-${String(i + 1).padStart(2, "0")}`;
      await env.DB.prepare(`INSERT OR IGNORE INTO feedback_360_question_bank
        (question_id, relation_type, theme, theme_th, question_text, question_type, sort_order, active)
        VALUES(?, ?, ?, ?, ?, ?, ?, 1)`)
        .bind(qid, relation, theme, THEME_TH[theme] || theme, text, type, i + 1).run();
    }
  }
}

export async function handle360(path, request, env, ctx) {
  await ensureFb360Tables(env);
  if (path === "/360/ping") return ctx.json({ ok: true, module: "feedback360", status: "phaseA", at: ctx.nowIso() });
  if (path === "/360/overview") return fb360Overview(request, env, ctx);
  if (path === "/360/cycle/save") return fb360CycleSave(request, env, ctx);
  if (path === "/360/cycle/delete") return fb360CycleDelete(request, env, ctx);
  if (path === "/360/questions") return fb360Questions(request, env, ctx);
  if (path === "/360/question/save") return fb360QuestionSave(request, env, ctx);
  if (path === "/360/question/delete") return fb360QuestionDelete(request, env, ctx);
  if (path === "/360/pairing/generate") return fb360Generate(request, env, ctx);   // Phase B
  if (path === "/360/pairing/list") return fb360PairingList(request, env, ctx);
  if (path === "/360/pairing/setboss") return fb360SetBoss(request, env, ctx);
  if (path === "/360/pairing/addpeer") return fb360AddPeer(request, env, ctx);
  if (path === "/360/pairing/remove") return fb360RemoveAssignment(request, env, ctx);
  if (path === "/360/pairing/confirm") return fb360Confirm(request, env, ctx);
  if (path === "/360/pairing/acceptpeer") return fb360AcceptPeer(request, env, ctx);       // exception queue: accept cross-dept
  if (path === "/360/pairing/acceptallcross") return fb360AcceptAllCross(request, env, ctx);
  if (path === "/360/pairing/unsend") return fb360Unsend(request, env, ctx);               // back to draft (re-edit)
  if (path === "/360/pairing/close") return fb360SetCycleStatus(request, env, ctx, "closed", "fb360_close");
  if (path === "/360/pairing/reopen") return fb360SetCycleStatus(request, env, ctx, "active", "fb360_reopen");
  if (path === "/360/my") return fb360My(request, env, ctx);           // Phase C: employee's assigned surveys
  if (path === "/360/form") return fb360Form(request, env, ctx);        // load one survey (questions + saved answers)
  if (path === "/360/submit") return fb360Submit(request, env, ctx);    // submit / overwrite answers
  if (path === "/360/report/overview") return fb360ReportOverview(request, env, ctx);  // Phase D: HR/Exec report hub
  if (path === "/360/report/subject") return fb360ReportSubject(request, env, ctx);    // per-person theme gap (HR)
  if (path === "/360/report/save") return fb360ReportSave(request, env, ctx);          // HR saves final narrative
  if (path === "/360/my/report") return fb360MyReport(request, env, ctx);              // D2: employee's own released report
  if (path === "/360/report/climate") return fb360Climate(request, env, ctx);          // ORG climate aggregate
  if (path === "/360/report/group") return fb360ReportGroup(request, env, ctx);         // dept/org rollup (Exec too)
  if (path === "/360/settings/save") return fb360SettingsSave(request, env, ctx);      // weights + min-N
  return ctx.json({ ok: false, error: "Unknown 360 route." }, 404);
}

const RELATIONS = ["self", "peer", "boss", "org"];
const RELATION_TH = { self: "ประเมินตนเอง (SELF)", peer: "เพื่อนร่วมงาน (PEER)", boss: "หัวหน้างาน (BOSS)", org: "องค์กร (ORGANIZATION)" };

async function fb360Overview(request, env, ctx) {
  await ctx.requireAdmin(request, env);
  const cyclesRes = await env.DB.prepare("SELECT * FROM feedback_360_cycles ORDER BY cycle_year DESC, cycle_period ASC").all();
  const cycles = (cyclesRes.results || []).map(c => ({ cycleId: c.cycle_id, year: c.cycle_year, period: c.cycle_period, status: c.status, startDate: c.start_date, dueDate: c.due_date }));
  const cntRes = await env.DB.prepare("SELECT relation_type, COUNT(*) AS n, SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) AS active_n FROM feedback_360_question_bank GROUP BY relation_type").all();
  const counts = {};
  (cntRes.results || []).forEach(r => { counts[r.relation_type] = { total: r.n, active: r.active_n }; });
  const questionCounts = RELATIONS.map(r => ({ relation: r, label: RELATION_TH[r], total: (counts[r] && counts[r].total) || 0, active: (counts[r] && counts[r].active) || 0 }));
  return ctx.json({ ok: true, cycles, questionCounts, relations: RELATIONS.map(r => ({ key: r, label: RELATION_TH[r] })) });
}

async function fb360CycleSave(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const year = Number(ctx.clean(input.year));
  const period = ctx.clean(input.period);
  if (!Number.isInteger(year) || year < 2500 || year > 2700) throw new Error("ปีไม่ถูกต้อง (ใส่เป็น พ.ศ. เช่น 2569)");
  if (!["H1", "H2"].includes(period)) throw new Error("รอบไม่ถูกต้อง (H1/H2)");
  const startDate = ctx.clean(input.startDate) || null;
  const dueDate = ctx.clean(input.dueDate) || null;
  const ts = ctx.nowIso();
  const dup = await env.DB.prepare("SELECT cycle_id FROM feedback_360_cycles WHERE cycle_year = ? AND cycle_period = ? LIMIT 1").bind(year, period).first();
  if (dup) {
    await env.DB.prepare("UPDATE feedback_360_cycles SET start_date=?, due_date=?, updated_at=? WHERE cycle_id=?").bind(startDate, dueDate, ts, dup.cycle_id).run();
    return ctx.json({ ok: true, cycleId: dup.cycle_id, existed: true });
  }
  const cycleId = await ctx.nextId(env, "FC");
  await env.DB.prepare("INSERT INTO feedback_360_cycles(cycle_id, cycle_year, cycle_period, status, start_date, due_date, created_at, updated_at) VALUES(?, ?, ?, 'draft', ?, ?, ?, ?)").bind(cycleId, year, period, startDate, dueDate, ts, ts).run();
  await ctx.logAdminAction(env, user, "fb360_cycle_create", cycleId, `${year} ${period}`);
  return ctx.json({ ok: true, cycleId });
}

async function fb360CycleDelete(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  // Cascade: responses (keyed by assignment) → assignments → gap reports → the cycle itself,
  // so deleting a (test) cycle leaves no orphan rows behind. Question bank is shared → untouched.
  await env.DB.prepare("DELETE FROM feedback_360_responses WHERE assignment_id IN (SELECT assignment_id FROM feedback_360_assignments WHERE cycle_id = ?)").bind(cycleId).run();
  await env.DB.prepare("DELETE FROM feedback_360_assignments WHERE cycle_id = ?").bind(cycleId).run();
  await env.DB.prepare("DELETE FROM feedback_360_gap_reports WHERE cycle_id = ?").bind(cycleId).run();
  await env.DB.prepare("DELETE FROM feedback_360_cycles WHERE cycle_id = ?").bind(cycleId).run();
  await ctx.logAdminAction(env, user, "fb360_cycle_delete", cycleId, "");
  return ctx.json({ ok: true });
}

// Question bank list (CMS). Optional filter by relation_type; grouped by theme for the UI.
async function fb360Questions(request, env, ctx) {
  const { input } = await ctx.requireAdmin(request, env);
  const relation = ctx.clean(input.relation);
  const res = relation
    ? await env.DB.prepare("SELECT * FROM feedback_360_question_bank WHERE relation_type = ? ORDER BY sort_order").bind(relation).all()
    : await env.DB.prepare("SELECT * FROM feedback_360_question_bank ORDER BY relation_type, sort_order").all();
  const questions = (res.results || []).map(q => ({
    questionId: q.question_id, relation: q.relation_type, theme: q.theme, themeTh: q.theme_th,
    text: q.question_text, type: q.question_type, sortOrder: q.sort_order, active: Boolean(q.active)
  }));
  return ctx.json({ ok: true, questions, themes: THEME_TH });
}

async function fb360QuestionSave(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const questionId = ctx.clean(input.questionId);
  const text = ctx.clean(input.text);
  if (!text) throw new Error("กรุณาใส่ข้อความคำถาม");
  const type = ctx.clean(input.type) === "open" ? "open" : "rating";
  const theme = ctx.clean(input.theme);
  const themeTh = THEME_TH[theme] || theme || null;
  const active = input.active === false || input.active === "0" || input.active === 0 ? 0 : 1;
  if (questionId) {
    await env.DB.prepare("UPDATE feedback_360_question_bank SET theme=?, theme_th=?, question_text=?, question_type=?, active=? WHERE question_id=?")
      .bind(theme || null, themeTh, text, type, active, questionId).run();
    await ctx.logAdminAction(env, user, "fb360_question_update", questionId, text.slice(0, 40));
    return ctx.json({ ok: true, questionId });
  }
  const relation = ctx.clean(input.relation);
  if (!RELATIONS.includes(relation)) throw new Error("relation ไม่ถูกต้อง (self/peer/boss/org)");
  const maxRow = await env.DB.prepare("SELECT MAX(sort_order) AS m FROM feedback_360_question_bank WHERE relation_type = ?").bind(relation).first();
  const order = ((maxRow && maxRow.m) || 0) + 1;
  const newId = `${relation}-x${await ctx.nextId(env, "Q")}`;
  await env.DB.prepare("INSERT INTO feedback_360_question_bank(question_id, relation_type, theme, theme_th, question_text, question_type, sort_order, active) VALUES(?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(newId, relation, theme || null, themeTh, text, type, order, active).run();
  await ctx.logAdminAction(env, user, "fb360_question_create", newId, text.slice(0, 40));
  return ctx.json({ ok: true, questionId: newId });
}

async function fb360QuestionDelete(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const questionId = ctx.clean(input.questionId);
  if (!questionId) throw new Error("questionId is required.");
  await env.DB.prepare("DELETE FROM feedback_360_question_bank WHERE question_id = ?").bind(questionId).run();
  await ctx.logAdminAction(env, user, "fb360_question_delete", questionId, "");
  return ctx.json({ ok: true });
}

// ============================================================================
// Phase B — auto-pairing (peer/boss/org) + preview/confirm
// PEER: same dept + same level + |rank diff| ≤ 2 · fallback = same level cross-dept (flagged)
// BOSS: nearest more-senior rank (smaller number) in same dept · none → flagged for manual assign
// RULE: never auto-send. Generate → draft → HR reviews/edits → confirm.
// ============================================================================
const PEER_TARGET = 3, PEER_CAP = 5, RANK_WINDOW = 2;

// Whole-org pool from Master Data (employee_id keyed) — NOT just linked users. Rationale: the whole
// company must be evaluated even before everyone has registered in the app; unlinked people can still
// be a SUBJECT (evaluated), and become an EVALUATOR who can answer once they register/link LINE.
async function fb360People(env) {
  const res = await env.DB.prepare(`
    SELECT employee_id, employee_name, level, rank, department, user_id, start_date
    FROM employees
    WHERE employment_status IS NULL OR employment_status NOT IN ('resigned', 'inactive')`).all();
  return (res.results || []).map(r => ({
    id: r.employee_id, name: r.employee_name || r.employee_id,
    level: r.level == null ? null : Number(r.level),
    rank: r.rank == null ? null : Number(r.rank),
    department: r.department || "", userId: r.user_id || null,
    startDate: r.start_date || null
  }));
}

// join-cutoff (days): staff who started more than N days after the cycle start are held for the next
// cycle (too new to evaluate / be evaluated fairly). Configurable; 0 disables.
async function fb360CutoffDays(env) {
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'feedback_360_join_cutoff_days'").first();
  const n = row ? Number(row.value) : 14;
  return Number.isInteger(n) && n >= 0 ? n : 14;
}
function fb360AddDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fb360Generate(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const cyc = await env.DB.prepare("SELECT status, start_date FROM feedback_360_cycles WHERE cycle_id = ?").bind(cycleId).first();
  if (!cyc) throw new Error("ไม่พบรอบ 360");
  if (cyc.status !== "draft") throw new Error("รอบนี้ยืนยันแล้ว — ต้องกด 'ยกเลิกการส่ง' ก่อนจึงจะสร้างคู่ใหม่ได้");
  const everyone = await fb360People(env);
  if (!everyone.length) throw new Error("ยังไม่มีพนักงานที่ผูก LINE + มีข้อมูล — เพิ่ม/ผูกพนักงานก่อน");
  // Join-cutoff: exclude staff who started too long after the cycle began (they wait for next cycle).
  const cutoffDays = await fb360CutoffDays(env);
  const cutoff = (cyc.start_date && cutoffDays > 0) ? fb360AddDays(cyc.start_date, cutoffDays) : null;
  let excluded = 0;
  const people = cutoff ? everyone.filter(p => { if (p.startDate && p.startDate > cutoff) { excluded++; return false; } return true; }) : everyone;
  if (!people.length) throw new Error("หลังใช้กฎ cutoff แล้วไม่เหลือพนักงานในรอบนี้ (ตรวจวันเริ่มรอบ/วันเริ่มงาน)");

  const ins = [];
  const add = (evaluator, subject, relation, cross) => ins.push([evaluator, subject, relation, cross ? 1 : 0]);
  const evalCount = {};
  // SELF + ORG (everyone, automatic)
  for (const p of people) { add(p.id, p.id, "self", 0); add(p.id, null, "org", 0); }
  // BOSS: nearest senior in same dept
  for (const p of people) {
    if (p.rank == null) continue;
    const seniors = people.filter(x => x.id !== p.id && x.department === p.department && x.rank != null && x.rank < p.rank);
    if (seniors.length) {
      const nearest = Math.max(...seniors.map(x => x.rank));
      const boss = seniors.filter(x => x.rank === nearest).sort((a, b) => a.name.localeCompare(b.name))[0];
      add(p.id, boss.id, "boss", 0);
    }
  }
  // PEER: for each subject pick up to TARGET peers, spread load, respect cap
  for (const subj of people) {
    if (subj.level == null || subj.rank == null) continue;
    let cross = false;
    let pool = people.filter(x => x.id !== subj.id && x.department === subj.department && x.level === subj.level && x.rank != null && Math.abs(x.rank - subj.rank) <= RANK_WINDOW);
    if (pool.length < 2) { pool = people.filter(x => x.id !== subj.id && x.level === subj.level); cross = true; }
    pool.sort((a, b) => (evalCount[a.id] || 0) - (evalCount[b.id] || 0));
    let picked = 0;
    for (const peer of pool) {
      if (picked >= PEER_TARGET) break;
      if ((evalCount[peer.id] || 0) >= PEER_CAP) continue;
      add(peer.id, subj.id, "peer", cross && peer.department !== subj.department ? 1 : 0);
      evalCount[peer.id] = (evalCount[peer.id] || 0) + 1;
      picked++;
    }
  }

  await env.DB.prepare("DELETE FROM feedback_360_responses WHERE assignment_id IN (SELECT assignment_id FROM feedback_360_assignments WHERE cycle_id = ?)").bind(cycleId).run();
  await env.DB.prepare("DELETE FROM feedback_360_assignments WHERE cycle_id = ?").bind(cycleId).run();
  const ts = ctx.nowIso();
  const stmts = ins.map(a => env.DB.prepare(
    "INSERT INTO feedback_360_assignments(assignment_id, cycle_id, evaluator_user_id, subject_user_id, relation_type, is_cross_department, status, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
    .bind(crypto.randomUUID(), cycleId, a[0], a[1], a[2], a[3], ts, ts));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  await ctx.logAdminAction(env, user, "fb360_generate", cycleId, `${ins.length} assignments, ${excluded} excluded`);
  return ctx.json({ ok: true, count: ins.length, excluded, cutoffDays });
}

// Preview: assignments grouped for review + who has no boss + candidate people for manual add.
async function fb360PairingList(request, env, ctx) {
  const { input } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const cyc = await env.DB.prepare("SELECT * FROM feedback_360_cycles WHERE cycle_id = ?").bind(cycleId).first();
  const people = await fb360People(env);
  const nameOf = {}; people.forEach(p => { nameOf[p.id] = p.name; });
  const res = await env.DB.prepare("SELECT * FROM feedback_360_assignments WHERE cycle_id = ? ORDER BY relation_type").bind(cycleId).all();
  const rows = (res.results || []).map(a => ({
    assignmentId: a.assignment_id, evaluatorId: a.evaluator_user_id, subjectId: a.subject_user_id,
    evaluatorName: nameOf[a.evaluator_user_id] || a.evaluator_user_id, subjectName: a.subject_user_id ? (nameOf[a.subject_user_id] || a.subject_user_id) : null,
    relation: a.relation_type, cross: Boolean(a.is_cross_department), reviewed: Boolean(a.reviewed)
  }));
  const counts = { self: 0, peer: 0, boss: 0, org: 0 };
  rows.forEach(r => { counts[r.relation] = (counts[r.relation] || 0) + 1; });
  const peersBySubject = {};
  rows.filter(r => r.relation === "peer").forEach(r => { (peersBySubject[r.subjectId] = peersBySubject[r.subjectId] || []).push(r); });
  const peerGroups = Object.keys(peersBySubject).map(sid => ({ subjectId: sid, subjectName: nameOf[sid] || sid, evaluators: peersBySubject[sid] }));
  const bossRows = rows.filter(r => r.relation === "boss").map(r => ({ assignmentId: r.assignmentId, subordinateId: r.evaluatorId, subordinateName: r.evaluatorName, bossId: r.subjectId, bossName: r.subjectName }));
  const withBoss = new Set(bossRows.map(b => b.subordinateId));
  const noBoss = people.filter(p => !withBoss.has(p.id)).map(p => ({ id: p.id, name: p.name, department: p.department }));
  return ctx.json({
    ok: true,
    cycle: cyc ? { cycleId: cyc.cycle_id, year: cyc.cycle_year, period: cyc.cycle_period, status: cyc.status } : null,
    counts, total: rows.length, peerGroups, bossRows, noBoss,
    people: people.map(p => ({ id: p.id, name: p.name, department: p.department, level: p.level, rank: p.rank }))
  });
}

async function fb360AssertDraft(env, cycleId) {
  const cyc = await env.DB.prepare("SELECT status FROM feedback_360_cycles WHERE cycle_id = ?").bind(cycleId).first();
  if (!cyc) throw new Error("ไม่พบรอบ");
  if (cyc.status !== "draft") throw new Error("รอบนี้ยืนยันแล้ว — กด 'ยกเลิกการส่ง' ก่อนจึงจะแก้ได้");
}

async function fb360SetBoss(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  const subordinate = ctx.clean(input.subordinateId);
  const boss = ctx.clean(input.bossId);
  if (!cycleId || !subordinate || !boss) throw new Error("ต้องระบุ cycleId, subordinate, boss");
  if (subordinate === boss) throw new Error("เลือกหัวหน้าเป็นตัวเองไม่ได้");
  await fb360AssertDraft(env, cycleId);
  const ts = ctx.nowIso();
  await env.DB.prepare("DELETE FROM feedback_360_responses WHERE assignment_id IN (SELECT assignment_id FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'boss' AND evaluator_user_id = ?)").bind(cycleId, subordinate).run();
  await env.DB.prepare("DELETE FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'boss' AND evaluator_user_id = ?").bind(cycleId, subordinate).run();
  await env.DB.prepare("INSERT INTO feedback_360_assignments(assignment_id, cycle_id, evaluator_user_id, subject_user_id, relation_type, is_cross_department, status, created_at, updated_at) VALUES(?, ?, ?, ?, 'boss', 0, 'draft', ?, ?)")
    .bind(crypto.randomUUID(), cycleId, subordinate, boss, ts, ts).run();
  await ctx.logAdminAction(env, user, "fb360_setboss", cycleId, `${subordinate}→${boss}`);
  return ctx.json({ ok: true });
}

async function fb360AddPeer(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  const subject = ctx.clean(input.subjectId);
  const peer = ctx.clean(input.peerId);
  if (!cycleId || !subject || !peer) throw new Error("ต้องระบุ cycleId, subject, peer");
  if (subject === peer) throw new Error("เลือกเพื่อนเป็นตัวเองไม่ได้");
  await fb360AssertDraft(env, cycleId);
  const dup = await env.DB.prepare("SELECT 1 FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'peer' AND evaluator_user_id = ? AND subject_user_id = ? LIMIT 1").bind(cycleId, peer, subject).first();
  if (dup) return ctx.json({ ok: true, existed: true });
  const emp = await env.DB.prepare("SELECT department FROM employees WHERE employee_id = ?").bind(peer).first();
  const subjEmp = await env.DB.prepare("SELECT department FROM employees WHERE employee_id = ?").bind(subject).first();
  const cross = emp && subjEmp && emp.department !== subjEmp.department ? 1 : 0;
  const ts = ctx.nowIso();
  await env.DB.prepare("INSERT INTO feedback_360_assignments(assignment_id, cycle_id, evaluator_user_id, subject_user_id, relation_type, is_cross_department, status, created_at, updated_at) VALUES(?, ?, ?, ?, 'peer', ?, 'draft', ?, ?)")
    .bind(crypto.randomUUID(), cycleId, peer, subject, cross, ts, ts).run();
  await ctx.logAdminAction(env, user, "fb360_addpeer", cycleId, `${peer}→${subject}`);
  return ctx.json({ ok: true });
}

async function fb360RemoveAssignment(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const assignmentId = ctx.clean(input.assignmentId);
  if (!assignmentId) throw new Error("assignmentId is required.");
  const a = await env.DB.prepare("SELECT cycle_id FROM feedback_360_assignments WHERE assignment_id = ?").bind(assignmentId).first();
  if (!a) return ctx.json({ ok: true });
  await fb360AssertDraft(env, a.cycle_id);
  await env.DB.prepare("DELETE FROM feedback_360_responses WHERE assignment_id = ?").bind(assignmentId).run();
  await env.DB.prepare("DELETE FROM feedback_360_assignments WHERE assignment_id = ?").bind(assignmentId).run();
  await ctx.logAdminAction(env, user, "fb360_remove_assignment", assignmentId, "");
  return ctx.json({ ok: true });
}

async function fb360Confirm(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback_360_assignments WHERE cycle_id = ?").bind(cycleId).first();
  if (!cnt || !cnt.n) throw new Error("ยังไม่มีการจับคู่ — กด 'สร้างคู่อัตโนมัติ' ก่อน");
  const ts = ctx.nowIso();
  // Only flip draft→sent so that already-answered ('completed') assignments keep their state
  // across an unsend/re-send cycle (their responses are preserved).
  await env.DB.prepare("UPDATE feedback_360_assignments SET status = 'sent', updated_at = ? WHERE cycle_id = ? AND status = 'draft'").bind(ts, cycleId).run();
  await env.DB.prepare("UPDATE feedback_360_cycles SET status = 'active', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await ctx.logAdminAction(env, user, "fb360_confirm_send", cycleId, `${cnt.n} assignments`);
  return ctx.json({ ok: true, count: cnt.n });
}

// Escape hatches after send: unsend (back to draft to re-edit), close (stop accepting answers),
// reopen (resume). Responses are always preserved. UI hides answering when cycle is not 'active'.
async function fb360Unsend(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const ts = ctx.nowIso();
  await env.DB.prepare("UPDATE feedback_360_assignments SET status = 'draft', updated_at = ? WHERE cycle_id = ? AND status = 'sent'").bind(ts, cycleId).run();
  await env.DB.prepare("UPDATE feedback_360_cycles SET status = 'draft', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await ctx.logAdminAction(env, user, "fb360_unsend", cycleId, "");
  return ctx.json({ ok: true });
}
async function fb360SetCycleStatus(request, env, ctx, status, action) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  await env.DB.prepare("UPDATE feedback_360_cycles SET status = ?, updated_at = ? WHERE cycle_id = ?").bind(status, ctx.nowIso(), cycleId).run();
  await ctx.logAdminAction(env, user, action, cycleId, status);
  return ctx.json({ ok: true, status });
}

// Exception queue: HR accepts a flagged cross-department peer (reviewed=1 → leaves the queue).
async function fb360AcceptPeer(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const assignmentId = ctx.clean(input.assignmentId);
  if (!assignmentId) throw new Error("assignmentId is required.");
  const a = await env.DB.prepare("SELECT cycle_id FROM feedback_360_assignments WHERE assignment_id = ?").bind(assignmentId).first();
  if (!a) return ctx.json({ ok: true });
  await fb360AssertDraft(env, a.cycle_id);
  await env.DB.prepare("UPDATE feedback_360_assignments SET reviewed = 1 WHERE assignment_id = ?").bind(assignmentId).run();
  await ctx.logAdminAction(env, user, "fb360_accept_peer", assignmentId, "");
  return ctx.json({ ok: true });
}
async function fb360AcceptAllCross(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  await fb360AssertDraft(env, cycleId);
  const r = await env.DB.prepare("UPDATE feedback_360_assignments SET reviewed = 1 WHERE cycle_id = ? AND relation_type = 'peer' AND is_cross_department = 1 AND (reviewed IS NULL OR reviewed = 0)").bind(cycleId).run();
  await ctx.logAdminAction(env, user, "fb360_accept_all_cross", cycleId, "");
  return ctx.json({ ok: true });
}

// ============================================================================
// Phase C — employees answer their assigned surveys (self / peer / boss / org).
// Anonymity is toward the SUBJECT: an evaluator sees who they evaluate, but the
// subject never learns who scored them (enforced in the report layer, not here).
// Auth via resolveActor → user.employee_id (assignments are keyed by employee_id).
// ============================================================================

// List the surveys this employee must fill in (evaluator side), active cycles only.
async function fb360My(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const empId = user.employee_id;
  if (!empId) return ctx.json({ ok: true, assignments: [] });   // unlinked account has no assignments yet
  const res = await env.DB.prepare(`
    SELECT a.assignment_id, a.cycle_id, a.subject_user_id, a.relation_type, a.status,
           c.cycle_year, c.cycle_period, c.due_date
    FROM feedback_360_assignments a
    JOIN feedback_360_cycles c ON c.cycle_id = a.cycle_id
    WHERE a.evaluator_user_id = ? AND c.status = 'active'
    ORDER BY a.relation_type`).bind(empId).all();
  const rows = res.results || [];
  const people = await fb360People(env);
  const nameOf = {}; people.forEach(p => { nameOf[p.id] = p.name; });
  const assignments = rows.map(a => ({
    assignmentId: a.assignment_id, cycleId: a.cycle_id, relation: a.relation_type,
    subjectName: a.relation_type === "org" ? null : (a.subject_user_id === empId ? "ตนเอง" : (nameOf[a.subject_user_id] || a.subject_user_id)),
    done: a.status === "completed",
    year: a.cycle_year, period: a.cycle_period, dueDate: a.due_date
  }));
  return ctx.json({ ok: true, assignments });
}

// Verify the actor owns this assignment; return the assignment row (throws otherwise).
async function fb360OwnAssignment(env, ctx, user, assignmentId) {
  const a = await env.DB.prepare(`
    SELECT a.*, c.status AS cycle_status, c.cycle_year, c.cycle_period
    FROM feedback_360_assignments a JOIN feedback_360_cycles c ON c.cycle_id = a.cycle_id
    WHERE a.assignment_id = ?`).bind(assignmentId).first();
  if (!a) throw new Error("ไม่พบแบบประเมิน");
  if (a.evaluator_user_id !== user.employee_id) throw new Error("แบบประเมินนี้ไม่ใช่ของคุณ");
  return a;
}

// Load one survey: its active questions (by relation) + any previously saved answers (to resume/edit).
async function fb360Form(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const assignmentId = ctx.clean(input.assignmentId);
  if (!assignmentId) throw new Error("assignmentId จำเป็น");
  const a = await fb360OwnAssignment(env, ctx, user, assignmentId);
  const qRes = await env.DB.prepare("SELECT question_id, theme, theme_th, question_text, question_type FROM feedback_360_question_bank WHERE relation_type = ? AND active = 1 ORDER BY sort_order").bind(a.relation_type).all();
  const questions = (qRes.results || []).map(q => ({ questionId: q.question_id, theme: q.theme, themeTh: q.theme_th, text: q.question_text, type: q.question_type }));
  const rRes = await env.DB.prepare("SELECT question_id, score, open_text FROM feedback_360_responses WHERE assignment_id = ?").bind(assignmentId).all();
  const answers = {};
  (rRes.results || []).forEach(r => { answers[r.question_id] = { score: r.score, openText: r.open_text }; });
  let subjectName = null;
  if (a.relation_type !== "org" && a.subject_user_id) {
    const s = await env.DB.prepare("SELECT employee_name FROM employees WHERE employee_id = ?").bind(a.subject_user_id).first();
    subjectName = a.subject_user_id === user.employee_id ? "ตนเอง" : ((s && s.employee_name) || a.subject_user_id);
  }
  return ctx.json({
    ok: true,
    assignment: { assignmentId, relation: a.relation_type, subjectName, done: a.status === "completed", locked: a.cycle_status !== "active", year: a.cycle_year, period: a.cycle_period },
    questions, answers
  });
}

// Submit (or overwrite) all answers for one survey. Rating Qs need score 1-5; open Qs are free text.
async function fb360Submit(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const assignmentId = ctx.clean(input.assignmentId);
  if (!assignmentId) throw new Error("assignmentId จำเป็น");
  const a = await fb360OwnAssignment(env, ctx, user, assignmentId);
  if (a.cycle_status !== "active") throw new Error("รอบนี้ปิดแล้ว ตอบไม่ได้");
  const qRes = await env.DB.prepare("SELECT question_id, theme, question_type FROM feedback_360_question_bank WHERE relation_type = ? AND active = 1").bind(a.relation_type).all();
  const qMap = {}; (qRes.results || []).forEach(q => { qMap[q.question_id] = q; });
  const answers = Array.isArray(input.answers) ? input.answers : [];
  const ts = ctx.nowIso();
  const inserts = [];
  let rated = 0;
  for (const ans of answers) {
    const q = qMap[ctx.clean(ans.questionId)];
    if (!q) continue;                                 // ignore unknown/inactive questions
    let score = null, openText = null;
    if (q.question_type === "open") {
      openText = ctx.clean(ans.openText) || null;
      if (!openText) continue;                        // skip empty open answers
    } else {
      const s = Number(ans.score);
      if (!Number.isInteger(s) || s < 1 || s > 5) continue;   // skip unrated / out-of-range
      score = s; rated++;
    }
    inserts.push(env.DB.prepare("INSERT INTO feedback_360_responses(response_id, assignment_id, question_id, theme, score, open_text, submitted_at) VALUES(?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), assignmentId, q.question_id, q.theme || null, score, openText, ts));
  }
  if (!rated) throw new Error("กรุณาให้คะแนนอย่างน้อย 1 ข้อ");
  // Atomic overwrite: clear prior answers + insert the fresh set in one batch (D1 batch = transaction).
  const batch = [env.DB.prepare("DELETE FROM feedback_360_responses WHERE assignment_id = ?").bind(assignmentId), ...inserts];
  await env.DB.batch(batch);
  await env.DB.prepare("UPDATE feedback_360_assignments SET status = 'completed', updated_at = ? WHERE assignment_id = ?").bind(ts, assignmentId).run();
  return ctx.json({ ok: true, saved: inserts.length });
}

// ============================================================================
// Phase D — Gap report. Gaps are compared at THEME level (people axes share 5 themes),
// self/peer/boss averaged per theme then weighted (boss/peer/self, config in app_settings —
// NEVER hardcoded). ORG is a separate climate aggregate (6 different themes, no gap).
// This chunk (D1) is HR-facing (raw). Exec aggregate + employee release = D2.
// ============================================================================
const PEOPLE_AXES = ["self", "peer", "boss"];

async function fb360Weights(env) {
  const def = { boss: 0.4, peer: 0.4, self: 0.2 };
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'feedback_360_weights'").first();
  if (!row) return def;
  try {
    const v = JSON.parse(row.value);
    return { boss: Number(v.boss) || def.boss, peer: Number(v.peer) || def.peer, self: Number(v.self) || def.self };
  } catch (e) { return def; }
}
async function fb360MinResponses(env) {
  const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = 'feedback_360_min_responses'").first();
  const n = row ? Number(row.value) : 3;
  return Number.isInteger(n) && n > 0 ? n : 3;
}

// Auto-drafted narrative (HR edits before release). Words over raw numbers, per north star.
function fb360DraftSummary(themes, counts) {
  const rated = themes.filter(t => t.overall != null);
  if (!rated.length) return "ยังไม่มีคะแนนเพียงพอสำหรับสร้างสรุป";
  const byOverall = [...rated].sort((a, b) => b.overall - a.overall);
  const strong = byOverall[0], weak = byOverall[byOverall.length - 1];
  const byGap = rated.filter(t => t.gap != null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const parts = [`ผู้ประเมิน: เพื่อนร่วมงาน ${counts.peer} คน · หัวหน้า ${counts.boss} คน`];
  parts.push(`จุดแข็ง: ${strong.themeTh} (เฉลี่ย ${strong.overall.toFixed(2)}/5)`);
  if (weak && weak !== strong) parts.push(`ควรพัฒนา: ${weak.themeTh} (เฉลี่ย ${weak.overall.toFixed(2)}/5)`);
  if (byGap.length) {
    const g = byGap[0];
    const dir = g.gap > 0 ? "มองตนเองสูงกว่าที่ผู้อื่นมอง" : "ผู้อื่นมองสูงกว่าที่ประเมินตนเอง";
    parts.push(`ช่องว่างการรับรู้มากสุด: ${g.themeTh} — ${dir} (ต่าง ${Math.abs(g.gap).toFixed(2)})`);
  }
  return parts.join("\n");
}

// HR/Exec hub: cycles + subjects with response coverage + report status + settings + climate availability.
async function fb360ReportOverview(request, env, ctx) {
  const { input } = await ctx.requireViewer(request, env);
  const cycRes = await env.DB.prepare("SELECT * FROM feedback_360_cycles ORDER BY cycle_year DESC, cycle_period ASC").all();
  const cycles = (cycRes.results || []).map(c => ({ cycleId: c.cycle_id, year: c.cycle_year, period: c.cycle_period, status: c.status }));
  let cycleId = ctx.clean(input.cycleId);
  if (!cycleId) { const pick = cycles.find(c => c.status === "active") || cycles[0]; cycleId = pick ? pick.cycleId : null; }
  const weights = await fb360Weights(env);
  const minN = await fb360MinResponses(env);
  const cutoffDays = await fb360CutoffDays(env);
  if (!cycleId) return ctx.json({ ok: true, cycles, cycleId: null, subjects: [], climate: { responders: 0 }, weights, minN, cutoffDays });
  const people = await fb360People(env);
  const nameOf = {}, deptOf = {}; people.forEach(p => { nameOf[p.id] = p.name; deptOf[p.id] = p.department; });
  // distinct responders per subject per people-axis (completed only = actually answered)
  const covRes = await env.DB.prepare(`
    SELECT subject_user_id AS sid, relation_type AS rel, COUNT(DISTINCT evaluator_user_id) AS n
    FROM feedback_360_assignments
    WHERE cycle_id = ? AND relation_type IN ('self','peer','boss') AND status = 'completed'
    GROUP BY subject_user_id, relation_type`).bind(cycleId).all();
  const cov = {};
  (covRes.results || []).forEach(r => { (cov[r.sid] = cov[r.sid] || { self: 0, peer: 0, boss: 0 })[r.rel] = r.n; });
  const repRes = await env.DB.prepare("SELECT subject_user_id, status FROM feedback_360_gap_reports WHERE cycle_id = ?").bind(cycleId).all();
  const repOf = {}; (repRes.results || []).forEach(r => { repOf[r.subject_user_id] = r.status; });
  const subjects = Object.keys(cov).map(sid => ({
    id: sid, name: nameOf[sid] || sid, department: deptOf[sid] || "",
    self: cov[sid].self || 0, peer: cov[sid].peer || 0, boss: cov[sid].boss || 0,
    reportStatus: repOf[sid] || null
  })).sort((a, b) => (b.peer + b.boss) - (a.peer + a.boss) || a.name.localeCompare(b.name));
  const climR = await env.DB.prepare("SELECT COUNT(DISTINCT evaluator_user_id) AS n FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'org' AND status = 'completed'").bind(cycleId).first();
  return ctx.json({ ok: true, cycles, cycleId, subjects, climate: { responders: (climR && climR.n) || 0 }, weights, minN, cutoffDays });
}

// Shared aggregation: per-theme sums by relation + distinct responder counts + anonymized comments.
async function fb360Aggregate(env, cycleId, subjectId) {
  const res = await env.DB.prepare(`
    SELECT a.relation_type AS rel, r.theme AS theme, r.score AS score, a.evaluator_user_id AS ev
    FROM feedback_360_responses r JOIN feedback_360_assignments a ON a.assignment_id = r.assignment_id
    WHERE a.cycle_id = ? AND a.subject_user_id = ? AND a.relation_type IN ('self','peer','boss') AND r.score IS NOT NULL`).bind(cycleId, subjectId).all();
  const agg = {}, responders = { self: new Set(), peer: new Set(), boss: new Set() };
  (res.results || []).forEach(row => {
    if (responders[row.rel]) responders[row.rel].add(row.ev);
    const t = row.theme || "อื่นๆ";
    agg[t] = agg[t] || {};
    (agg[t][row.rel] = agg[t][row.rel] || { sum: 0, n: 0 });
    agg[t][row.rel].sum += row.score; agg[t][row.rel].n++;
  });
  const cRes = await env.DB.prepare(`
    SELECT a.relation_type AS rel, r.open_text AS txt
    FROM feedback_360_responses r JOIN feedback_360_assignments a ON a.assignment_id = r.assignment_id
    WHERE a.cycle_id = ? AND a.subject_user_id = ? AND a.relation_type IN ('self','peer','boss') AND r.open_text IS NOT NULL AND r.open_text <> ''`).bind(cycleId, subjectId).all();
  return {
    agg,
    counts: { self: responders.self.size, peer: responders.peer.size, boss: responders.boss.size },
    comments: (cRes.results || []).map(r => ({ rel: r.rel, text: r.txt }))   // no evaluator id → anonymous
  };
}
// `allow` gates which rater groups contribute (min-N masking for the employee-facing view).
function fb360BuildThemes(agg, weights, allow) {
  return Object.keys(agg).map(t => {
    const g = agg[t];
    const avg = rel => (allow[rel] && g[rel] && g[rel].n) ? g[rel].sum / g[rel].n : null;
    const selfA = avg("self"), peerA = avg("peer"), bossA = avg("boss");
    let ws = 0, wt = 0;
    if (selfA != null) { ws += selfA * weights.self; wt += weights.self; }
    if (peerA != null) { ws += peerA * weights.peer; wt += weights.peer; }
    if (bossA != null) { ws += bossA * weights.boss; wt += weights.boss; }
    const overall = wt ? ws / wt : null;
    const others = [peerA, bossA].filter(v => v != null);
    const othersAvg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : null;
    const gap = (selfA != null && othersAvg != null) ? selfA - othersAvg : null;
    return { theme: t, themeTh: THEME_TH[t] || t, self: selfA, peer: peerA, boss: bossA, overall, gap };
  }).sort((a, b) => (b.overall || 0) - (a.overall || 0));
}

// Per-subject theme gap (HR only — sees raw). Anonymized comments (no evaluator identity leaves here).
async function fb360ReportSubject(request, env, ctx) {
  const { input } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId), subjectId = ctx.clean(input.subjectId);
  if (!cycleId || !subjectId) throw new Error("ต้องระบุ cycleId + subjectId");
  const weights = await fb360Weights(env), minN = await fb360MinResponses(env);
  const subjRow = await env.DB.prepare("SELECT employee_name, department FROM employees WHERE employee_id = ?").bind(subjectId).first();
  const { agg, counts, comments } = await fb360Aggregate(env, cycleId, subjectId);
  const themes = fb360BuildThemes(agg, weights, { self: true, peer: true, boss: true });   // HR sees raw
  const draftSummary = fb360DraftSummary(themes, counts);
  const rep = await env.DB.prepare("SELECT * FROM feedback_360_gap_reports WHERE cycle_id = ? AND subject_user_id = ?").bind(cycleId, subjectId).first();
  return ctx.json({
    ok: true,
    subject: { id: subjectId, name: (subjRow && subjRow.employee_name) || subjectId, department: (subjRow && subjRow.department) || "" },
    weights, minN, counts, themes, comments, draftSummary,
    finalSummary: rep ? (rep.final_summary || "") : "", status: rep ? rep.status : "draft"
  });
}

// D2 — employee's OWN report (only cycles HR has released). min-N masks small rater groups so a
// subject can't reverse-identify who answered. Curated final_summary is the headline.
async function fb360MyReport(request, env, ctx) {
  const input = await ctx.readJson(request);
  const user = await ctx.resolveActor(env, input);
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน");
  const empId = user.employee_id;
  if (!empId) return ctx.json({ ok: true, reports: [] });
  const weights = await fb360Weights(env), minN = await fb360MinResponses(env);
  const repRes = await env.DB.prepare(`
    SELECT g.cycle_id, g.final_summary, c.cycle_year, c.cycle_period
    FROM feedback_360_gap_reports g JOIN feedback_360_cycles c ON c.cycle_id = g.cycle_id
    WHERE g.subject_user_id = ? AND g.status = 'released' ORDER BY c.cycle_year DESC, c.cycle_period DESC`).bind(empId).all();
  const reports = [];
  for (const r of (repRes.results || [])) {
    const { agg, counts, comments } = await fb360Aggregate(env, r.cycle_id, empId);
    const allow = { self: true, peer: counts.peer >= minN, boss: counts.boss >= minN };
    const themes = fb360BuildThemes(agg, weights, allow);
    const shownComments = comments.filter(c => c.rel === "self" || allow[c.rel]);
    reports.push({
      cycleId: r.cycle_id, year: r.cycle_year, period: r.cycle_period,
      summary: r.final_summary || "", themes, comments: shownComments,
      hidden: { peer: !allow.peer, boss: !allow.boss }, minN
    });
  }
  return ctx.json({ ok: true, reports });
}

async function fb360ReportSave(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId), subjectId = ctx.clean(input.subjectId);
  if (!cycleId || !subjectId) throw new Error("ต้องระบุ cycleId + subjectId");
  const finalSummary = ctx.clean(input.finalSummary) || "";
  const status = ctx.clean(input.status) === "released" ? "released" : "draft";
  const draftSummary = ctx.clean(input.draftSummary) || "";
  const ts = ctx.nowIso();
  const existing = await env.DB.prepare("SELECT report_id FROM feedback_360_gap_reports WHERE cycle_id = ? AND subject_user_id = ?").bind(cycleId, subjectId).first();
  if (existing) {
    await env.DB.prepare("UPDATE feedback_360_gap_reports SET final_summary = ?, status = ?, updated_by = ?, updated_at = ? WHERE report_id = ?")
      .bind(finalSummary, status, user.user_id, ts, existing.report_id).run();
  } else {
    await env.DB.prepare("INSERT INTO feedback_360_gap_reports(report_id, cycle_id, subject_user_id, draft_summary, final_summary, status, updated_by, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(await ctx.nextId(env, "FR"), cycleId, subjectId, draftSummary, finalSummary, status, user.user_id, ts).run();
  }
  await ctx.logAdminAction(env, user, "fb360_report_save", subjectId, status);
  return ctx.json({ ok: true, status });
}

// ORG climate: aggregate per (6 org) theme + anonymous comments. No gap comparison.
async function fb360Climate(request, env, ctx) {
  const { input } = await ctx.requireViewer(request, env);
  let cycleId = ctx.clean(input.cycleId);
  if (!cycleId) { const c = await env.DB.prepare("SELECT cycle_id FROM feedback_360_cycles WHERE status = 'active' ORDER BY cycle_year DESC LIMIT 1").first(); cycleId = c ? c.cycle_id : null; }
  if (!cycleId) return ctx.json({ ok: true, cycleId: null, themes: [], comments: [], responders: 0 });
  const res = await env.DB.prepare(`
    SELECT r.theme AS theme, r.score AS score
    FROM feedback_360_responses r JOIN feedback_360_assignments a ON a.assignment_id = r.assignment_id
    WHERE a.cycle_id = ? AND a.relation_type = 'org' AND r.score IS NOT NULL`).bind(cycleId).all();
  const agg = {};
  (res.results || []).forEach(r => { const t = r.theme || "อื่นๆ"; (agg[t] = agg[t] || { sum: 0, n: 0 }); agg[t].sum += r.score; agg[t].n++; });
  const themes = Object.keys(agg).map(t => ({ theme: t, themeTh: THEME_TH[t] || t, avg: agg[t].sum / agg[t].n, n: agg[t].n })).sort((a, b) => b.avg - a.avg);
  const cRes = await env.DB.prepare(`
    SELECT r.open_text AS txt FROM feedback_360_responses r JOIN feedback_360_assignments a ON a.assignment_id = r.assignment_id
    WHERE a.cycle_id = ? AND a.relation_type = 'org' AND r.open_text IS NOT NULL AND r.open_text <> ''`).bind(cycleId).all();
  const comments = (cRes.results || []).map(r => r.txt);
  const rr = await env.DB.prepare("SELECT COUNT(DISTINCT evaluator_user_id) AS n FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'org' AND status = 'completed'").bind(cycleId).first();
  return ctx.json({ ok: true, cycleId, themes, comments, responders: (rr && rr.n) || 0 });
}

async function fb360SettingsSave(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const boss = Number(input.boss), peer = Number(input.peer), self = Number(input.self);
  for (const v of [boss, peer, self]) if (!(v >= 0 && v <= 1)) throw new Error("น้ำหนักต้องอยู่ระหว่าง 0-1 (เช่น 0.4)");
  if (boss + peer + self <= 0) throw new Error("น้ำหนักรวมต้องมากกว่า 0");
  const minN = Number(ctx.clean(input.minResponses));
  if (!Number.isInteger(minN) || minN < 1) throw new Error("จำนวนผู้ตอบขั้นต่ำต้องเป็นจำนวนเต็ม ≥ 1");
  const cutoff = Number(ctx.clean(input.joinCutoffDays));
  if (!Number.isInteger(cutoff) || cutoff < 0) throw new Error("วัน cutoff ต้องเป็นจำนวนเต็ม ≥ 0 (0 = ปิด)");
  const ts = ctx.nowIso();
  await env.DB.prepare("INSERT INTO app_settings(key, value, updated_at) VALUES('feedback_360_weights', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(JSON.stringify({ boss, peer, self }), ts).run();
  await env.DB.prepare("INSERT INTO app_settings(key, value, updated_at) VALUES('feedback_360_min_responses', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(String(minN), ts).run();
  await env.DB.prepare("INSERT INTO app_settings(key, value, updated_at) VALUES('feedback_360_join_cutoff_days', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(String(cutoff), ts).run();
  await ctx.logAdminAction(env, user, "fb360_settings_save", "weights", `${boss}/${peer}/${self} minN=${minN} cutoff=${cutoff}`);
  return ctx.json({ ok: true });
}

// Aggregate report across a GROUP of subjects (whole org, or one department) — aggregate-only,
// so Executives (requireViewer) may read it. Reuses the same theme/gap math as the per-person view.
async function fb360ReportGroup(request, env, ctx) {
  const { input } = await ctx.requireViewer(request, env);
  const cycRes = await env.DB.prepare("SELECT * FROM feedback_360_cycles ORDER BY cycle_year DESC, cycle_period ASC").all();
  const cycles = (cycRes.results || []).map(c => ({ cycleId: c.cycle_id, year: c.cycle_year, period: c.cycle_period, status: c.status }));
  let cycleId = ctx.clean(input.cycleId);
  if (!cycleId) { const pick = cycles.find(c => c.status === "active") || cycles.find(c => c.status === "closed") || cycles[0]; cycleId = pick ? pick.cycleId : null; }
  const weights = await fb360Weights(env);
  if (!cycleId) return ctx.json({ ok: true, cycles, cycleId: null, department: null, departments: [], themes: [], subjectCount: 0, climate: [], climateResponders: 0 });
  const dept = ctx.clean(input.department);
  const depRes = await env.DB.prepare("SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND department <> '' ORDER BY department").all();
  const departments = (depRes.results || []).map(r => r.department);
  const base = `SELECT a.relation_type AS rel, r.theme AS theme, r.score AS score, a.subject_user_id AS sid
    FROM feedback_360_responses r JOIN feedback_360_assignments a ON a.assignment_id = r.assignment_id`;
  const res = dept
    ? await env.DB.prepare(`${base} JOIN employees e ON e.employee_id = a.subject_user_id WHERE a.cycle_id = ? AND a.relation_type IN ('self','peer','boss') AND r.score IS NOT NULL AND e.department = ?`).bind(cycleId, dept).all()
    : await env.DB.prepare(`${base} WHERE a.cycle_id = ? AND a.relation_type IN ('self','peer','boss') AND r.score IS NOT NULL`).bind(cycleId).all();
  const agg = {}, subjects = new Set();
  (res.results || []).forEach(row => {
    subjects.add(row.sid);
    const t = row.theme || "อื่นๆ";
    agg[t] = agg[t] || {};
    (agg[t][row.rel] = agg[t][row.rel] || { sum: 0, n: 0 });
    agg[t][row.rel].sum += row.score; agg[t][row.rel].n++;
  });
  const themes = fb360BuildThemes(agg, weights, { self: true, peer: true, boss: true });
  const cRes = await env.DB.prepare(`SELECT r.theme AS theme, r.score AS score FROM feedback_360_responses r JOIN feedback_360_assignments a ON a.assignment_id = r.assignment_id WHERE a.cycle_id = ? AND a.relation_type = 'org' AND r.score IS NOT NULL`).bind(cycleId).all();
  const cagg = {};
  (cRes.results || []).forEach(r => { const t = r.theme || "อื่นๆ"; (cagg[t] = cagg[t] || { sum: 0, n: 0 }); cagg[t].sum += r.score; cagg[t].n++; });
  const climate = Object.keys(cagg).map(t => ({ theme: t, themeTh: THEME_TH[t] || t, avg: cagg[t].sum / cagg[t].n })).sort((a, b) => b.avg - a.avg);
  const rr = await env.DB.prepare("SELECT COUNT(DISTINCT evaluator_user_id) AS n FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'org' AND status = 'completed'").bind(cycleId).first();
  return ctx.json({ ok: true, cycles, cycleId, department: dept || null, departments, themes, subjectCount: subjects.size, climate, climateResponders: (rr && rr.n) || 0 });
}
