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

async function fb360People(env) {
  const res = await env.DB.prepare(`
    SELECT u.user_id, u.name, e.level, e.rank, e.department
    FROM users u JOIN employees e ON e.user_id = u.user_id
    WHERE u.active = 1`).all();
  return (res.results || []).map(r => ({
    userId: r.user_id, name: r.name || r.user_id,
    level: r.level == null ? null : Number(r.level),
    rank: r.rank == null ? null : Number(r.rank),
    department: r.department || ""
  }));
}

async function fb360Generate(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const cyc = await env.DB.prepare("SELECT status FROM feedback_360_cycles WHERE cycle_id = ?").bind(cycleId).first();
  if (!cyc) throw new Error("ไม่พบรอบ 360");
  if (cyc.status === "sent") throw new Error("รอบนี้ส่งแล้ว — สร้างคู่ใหม่ไม่ได้ (สร้างรอบใหม่แทน)");
  const people = await fb360People(env);
  if (!people.length) throw new Error("ยังไม่มีพนักงานที่ผูก LINE + มีข้อมูล — เพิ่ม/ผูกพนักงานก่อน");

  const ins = [];
  const add = (evaluator, subject, relation, cross) => ins.push([evaluator, subject, relation, cross ? 1 : 0]);
  const evalCount = {};
  // SELF + ORG (everyone, automatic)
  for (const p of people) { add(p.userId, p.userId, "self", 0); add(p.userId, null, "org", 0); }
  // BOSS: nearest senior in same dept
  for (const p of people) {
    if (p.rank == null) continue;
    const seniors = people.filter(x => x.userId !== p.userId && x.department === p.department && x.rank != null && x.rank < p.rank);
    if (seniors.length) {
      const nearest = Math.max(...seniors.map(x => x.rank));
      const boss = seniors.filter(x => x.rank === nearest).sort((a, b) => a.name.localeCompare(b.name))[0];
      add(p.userId, boss.userId, "boss", 0);
    }
  }
  // PEER: for each subject pick up to TARGET peers, spread load, respect cap
  for (const subj of people) {
    if (subj.level == null || subj.rank == null) continue;
    let cross = false;
    let pool = people.filter(x => x.userId !== subj.userId && x.department === subj.department && x.level === subj.level && x.rank != null && Math.abs(x.rank - subj.rank) <= RANK_WINDOW);
    if (pool.length < 2) { pool = people.filter(x => x.userId !== subj.userId && x.level === subj.level); cross = true; }
    pool.sort((a, b) => (evalCount[a.userId] || 0) - (evalCount[b.userId] || 0));
    let picked = 0;
    for (const peer of pool) {
      if (picked >= PEER_TARGET) break;
      if ((evalCount[peer.userId] || 0) >= PEER_CAP) continue;
      add(peer.userId, subj.userId, "peer", cross && peer.department !== subj.department ? 1 : 0);
      evalCount[peer.userId] = (evalCount[peer.userId] || 0) + 1;
      picked++;
    }
  }

  await env.DB.prepare("DELETE FROM feedback_360_assignments WHERE cycle_id = ?").bind(cycleId).run();
  const ts = ctx.nowIso();
  const stmts = ins.map(a => env.DB.prepare(
    "INSERT INTO feedback_360_assignments(assignment_id, cycle_id, evaluator_user_id, subject_user_id, relation_type, is_cross_department, status, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
    .bind(crypto.randomUUID(), cycleId, a[0], a[1], a[2], a[3], ts, ts));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  await ctx.logAdminAction(env, user, "fb360_generate", cycleId, `${ins.length} assignments`);
  return ctx.json({ ok: true, count: ins.length });
}

// Preview: assignments grouped for review + who has no boss + candidate people for manual add.
async function fb360PairingList(request, env, ctx) {
  const { input } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  if (!cycleId) throw new Error("cycleId is required.");
  const cyc = await env.DB.prepare("SELECT * FROM feedback_360_cycles WHERE cycle_id = ?").bind(cycleId).first();
  const people = await fb360People(env);
  const nameOf = {}; people.forEach(p => { nameOf[p.userId] = p.name; });
  const res = await env.DB.prepare("SELECT * FROM feedback_360_assignments WHERE cycle_id = ? ORDER BY relation_type").bind(cycleId).all();
  const rows = (res.results || []).map(a => ({
    assignmentId: a.assignment_id, evaluatorUserId: a.evaluator_user_id, subjectUserId: a.subject_user_id,
    evaluatorName: nameOf[a.evaluator_user_id] || a.evaluator_user_id, subjectName: a.subject_user_id ? (nameOf[a.subject_user_id] || a.subject_user_id) : null,
    relation: a.relation_type, cross: Boolean(a.is_cross_department)
  }));
  const counts = { self: 0, peer: 0, boss: 0, org: 0 };
  rows.forEach(r => { counts[r.relation] = (counts[r.relation] || 0) + 1; });
  // peers grouped by subject
  const peersBySubject = {};
  rows.filter(r => r.relation === "peer").forEach(r => { (peersBySubject[r.subjectUserId] = peersBySubject[r.subjectUserId] || []).push(r); });
  const peerGroups = Object.keys(peersBySubject).map(sid => ({ subjectUserId: sid, subjectName: nameOf[sid] || sid, evaluators: peersBySubject[sid] }));
  // boss list (subordinate → boss)
  const bossRows = rows.filter(r => r.relation === "boss").map(r => ({ assignmentId: r.assignmentId, subordinateUserId: r.evaluatorUserId, subordinateName: r.evaluatorName, bossUserId: r.subjectUserId, bossName: r.subjectName }));
  const withBoss = new Set(bossRows.map(b => b.subordinateUserId));
  const noBoss = people.filter(p => !withBoss.has(p.userId)).map(p => ({ userId: p.userId, name: p.name, department: p.department }));
  return ctx.json({
    ok: true,
    cycle: cyc ? { cycleId: cyc.cycle_id, year: cyc.cycle_year, period: cyc.cycle_period, status: cyc.status } : null,
    counts, total: rows.length, peerGroups, bossRows, noBoss,
    people: people.map(p => ({ userId: p.userId, name: p.name, department: p.department, level: p.level, rank: p.rank }))
  });
}

async function fb360AssertDraft(env, cycleId) {
  const cyc = await env.DB.prepare("SELECT status FROM feedback_360_cycles WHERE cycle_id = ?").bind(cycleId).first();
  if (!cyc) throw new Error("ไม่พบรอบ");
  if (cyc.status === "sent") throw new Error("รอบนี้ส่งแล้ว แก้ไขไม่ได้");
}

async function fb360SetBoss(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  const subordinate = ctx.clean(input.subordinateUserId);
  const boss = ctx.clean(input.bossUserId);
  if (!cycleId || !subordinate || !boss) throw new Error("ต้องระบุ cycleId, subordinate, boss");
  if (subordinate === boss) throw new Error("เลือกหัวหน้าเป็นตัวเองไม่ได้");
  await fb360AssertDraft(env, cycleId);
  const ts = ctx.nowIso();
  await env.DB.prepare("DELETE FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'boss' AND evaluator_user_id = ?").bind(cycleId, subordinate).run();
  await env.DB.prepare("INSERT INTO feedback_360_assignments(assignment_id, cycle_id, evaluator_user_id, subject_user_id, relation_type, is_cross_department, status, created_at, updated_at) VALUES(?, ?, ?, ?, 'boss', 0, 'draft', ?, ?)")
    .bind(crypto.randomUUID(), cycleId, subordinate, boss, ts, ts).run();
  await ctx.logAdminAction(env, user, "fb360_setboss", cycleId, `${subordinate}→${boss}`);
  return ctx.json({ ok: true });
}

async function fb360AddPeer(request, env, ctx) {
  const { input, user } = await ctx.requireAdmin(request, env);
  const cycleId = ctx.clean(input.cycleId);
  const subject = ctx.clean(input.subjectUserId);
  const peer = ctx.clean(input.peerUserId);
  if (!cycleId || !subject || !peer) throw new Error("ต้องระบุ cycleId, subject, peer");
  if (subject === peer) throw new Error("เลือกเพื่อนเป็นตัวเองไม่ได้");
  await fb360AssertDraft(env, cycleId);
  const dup = await env.DB.prepare("SELECT 1 FROM feedback_360_assignments WHERE cycle_id = ? AND relation_type = 'peer' AND evaluator_user_id = ? AND subject_user_id = ? LIMIT 1").bind(cycleId, peer, subject).first();
  if (dup) return ctx.json({ ok: true, existed: true });
  const emp = await env.DB.prepare("SELECT department FROM employees WHERE user_id = ?").bind(peer).first();
  const subjEmp = await env.DB.prepare("SELECT department FROM employees WHERE user_id = ?").bind(subject).first();
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
  await env.DB.prepare("UPDATE feedback_360_assignments SET status = 'sent', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await env.DB.prepare("UPDATE feedback_360_cycles SET status = 'active', updated_at = ? WHERE cycle_id = ?").bind(ts, cycleId).run();
  await ctx.logAdminAction(env, user, "fb360_confirm_send", cycleId, `${cnt.n} assignments`);
  return ctx.json({ ok: true, count: cnt.n });
}
