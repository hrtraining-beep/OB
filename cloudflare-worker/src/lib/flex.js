import { liffUrl } from "./core.js";

/* ============================================================
   Nose Tea — LINE Flex message design system (M3 / sage)
   Palette: primary #426454 · light sage #c5ebd7 · accent ส้ม #ef7b2f
   surface #ffffff · ink #1d2420 · muted #6b736e
   One shared look for: task cards, reminders, session announcements, preview.
   ============================================================ */

const COLOR = {
  primary: "#426454",
  onPrimary: "#ffffff",
  eyebrow: "#a9cbbb",
  subtitle: "#c5ebd7",
  accent: "#ef7b2f",
  ink: "#1d2420",
  muted: "#6b736e",
  amberBg: "#fff4c7",
  amberFg: "#92400e",
  sageBg: "#c5ebd7",
  sageFg: "#234034",
  neutralBg: "#eceeec",
  neutralFg: "#414844"
};

const TASK_META = {
  Feedback: { title: "ถึงเวลาประเมิน Feedback", tag: "Feedback", button: "ให้ Feedback", targetLabel: "ผู้รับการประเมิน" },
  Attendance: { title: "ยืนยันการเข้าร่วม", tag: "Attendance", button: "ยืนยันการเข้าร่วม", targetLabel: "ประเภท" },
  Reflection: { title: "ถึงเวลาส่ง Reflection", tag: "Reflection", button: "กรอก Reflection", targetLabel: "ประเภท" },
  Probation: { title: "ถึงรอบประเมินทดลองงาน", tag: "Probation", button: "เปิดแบบประเมิน", targetLabel: "พนักงาน" }
};

const STATUS_STYLE = {
  Pending: { label: "รอดำเนินการ", bg: "#fff4c7", fg: "#92400e" },
  Open: { label: "รอดำเนินการ", bg: "#fff4c7", fg: "#92400e" },
  Completed: { label: "เสร็จแล้ว", bg: "#c5ebd7", fg: "#234034" }
};

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const LOGO_URL = "https://ob-dkm.pages.dev/assets/logo.png";

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatThaiDate(value) {
  const text = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!m) return text || "ยังไม่กำหนด";
  const monthIndex = parseInt(m[2], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return text;
  return `${parseInt(m[3], 10)} ${TH_MONTHS[monthIndex]} ${m[1]}`;
}

function taskMeta(taskType) {
  return TASK_META[taskType] || { title: "มีงานที่ต้องดำเนินการ", tag: safeText(taskType, "Task"), button: "เปิดงาน", targetLabel: "งาน" };
}

/* ---------- shared building blocks ---------- */

function chip(text, bg = COLOR.accent, color = "#ffffff") {
  return {
    type: "box",
    layout: "vertical",
    flex: 0,
    backgroundColor: bg,
    cornerRadius: "10px",
    paddingTop: "5px",
    paddingBottom: "5px",
    paddingStart: "11px",
    paddingEnd: "11px",
    contents: [{ type: "text", text, color, size: "xs", weight: "bold" }]
  };
}

function logoBadge() {
  return {
    type: "box",
    layout: "vertical",
    flex: 0,
    width: "30px",
    height: "30px",
    backgroundColor: "#ffffff",
    cornerRadius: "15px",
    paddingAll: "4px",
    contents: [{ type: "image", url: LOGO_URL, size: "full", aspectMode: "fit", align: "center", gravity: "center" }]
  };
}

function brandHeader({ eyebrow = "NOSE TEA HR", tag, title, subtitle }) {
  const topRow = {
    type: "box",
    layout: "horizontal",
    alignItems: "center",
    spacing: "sm",
    contents: [logoBadge(), { type: "text", text: eyebrow, color: COLOR.eyebrow, size: "xs", weight: "bold", flex: 1, gravity: "center", wrap: false }]
  };
  if (tag) topRow.contents.push(chip(tag));

  const contents = [topRow, { type: "text", text: title, color: COLOR.onPrimary, weight: "bold", size: "lg", wrap: true, margin: "md" }];
  if (subtitle) contents.push({ type: "text", text: subtitle, color: COLOR.subtitle, size: "sm", wrap: true, margin: "sm" });

  return { type: "box", layout: "vertical", backgroundColor: COLOR.primary, paddingAll: "20px", contents };
}

function kvRow(label, value, valueColor = COLOR.ink) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: label, color: COLOR.muted, size: "sm", flex: 2, gravity: "top", wrap: true },
      { type: "text", text: value, color: valueColor, size: "sm", weight: "bold", align: "end", flex: 3, wrap: true }
    ]
  };
}

function statusRow(status) {
  const s = STATUS_STYLE[status] || { label: safeText(status, "-"), bg: COLOR.neutralBg, fg: COLOR.neutralFg };
  return {
    type: "box",
    layout: "horizontal",
    alignItems: "center",
    contents: [
      { type: "text", text: "สถานะ", color: COLOR.muted, size: "sm", flex: 1, gravity: "center" },
      {
        type: "box",
        layout: "vertical",
        flex: 0,
        backgroundColor: s.bg,
        cornerRadius: "8px",
        paddingTop: "4px",
        paddingBottom: "4px",
        paddingStart: "12px",
        paddingEnd: "12px",
        contents: [{ type: "text", text: s.label, color: s.fg, size: "xs", weight: "bold" }]
      }
    ]
  };
}

function calloutRow(label, value, bg = COLOR.amberBg, fg = COLOR.amberFg) {
  return {
    type: "box",
    layout: "horizontal",
    backgroundColor: bg,
    cornerRadius: "12px",
    paddingAll: "14px",
    alignItems: "center",
    contents: [
      { type: "text", text: label, color: fg, size: "sm", flex: 1, gravity: "center", wrap: true },
      { type: "text", text: value, color: fg, size: "md", weight: "bold", align: "end", flex: 0, gravity: "center", wrap: true }
    ]
  };
}

function noteText(text) {
  return { type: "text", text, color: COLOR.muted, size: "sm", wrap: true };
}

function ctaFooter(label, uri) {
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "16px",
    paddingTop: "12px",
    contents: [{ type: "button", style: "primary", color: COLOR.primary, height: "md", action: { type: "uri", label, uri } }]
  };
}

function bubble(header, bodyContents, footer) {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "0px",
      contents: [header, { type: "box", layout: "vertical", paddingAll: "20px", spacing: "md", contents: bodyContents }]
    },
    footer
  };
}

/* ---------- message builders ---------- */

export function reminderFlexMessage(message, buttonLabel = "เปิด HR Portal", taskId = "") {
  const header = brandHeader({
    tag: "แจ้งเตือน",
    title: "มีการแจ้งเตือนใหม่",
    subtitle: safeText(message, "มีงานที่ต้องตรวจสอบใน HR Portal")
  });
  return {
    type: "flex",
    altText: `Nose Tea HR Portal: ${safeText(message, "การแจ้งเตือน")}`,
    contents: bubble(header, [noteText("เปิด HR Portal เพื่อดูรายละเอียดและจัดการงานของคุณ")], ctaFooter(buttonLabel, liffUrl(taskId)))
  };
}

export function taskFlexMessage(task, user = {}) {
  const taskType = task.task_type || task.taskType || "Task";
  const meta = taskMeta(taskType);
  const taskId = task.task_id || task.taskId || "";
  const due = formatThaiDate(task.due_date || task.dueDate);
  const month = task.month_no || task.monthNo ? `Month ${task.month_no || task.monthNo}` : safeText(task.session_date || task.sessionDate, "รอบปัจจุบัน");
  const target = safeText(
    task.employee_name || task.target_name || task.employeeName || (taskType === "Feedback" ? "Mentee" : user.name || user.display_name),
    "ตัวคุณเอง"
  );
  const subtitle = safeText(task.title, "Nose Tea HR Task");

  const rows = [
    kvRow(meta.targetLabel, taskType === "Feedback" || taskType === "Probation" ? target : meta.tag),
    kvRow("รอบ", month),
    statusRow(safeText(task.status, "Pending")),
    calloutRow("กำหนดส่ง", due)
  ];

  const header = brandHeader({ tag: meta.tag, title: meta.title, subtitle });

  return {
    type: "flex",
    altText: `Nose Tea HR Portal: ${meta.title}`,
    contents: bubble(header, rows, ctaFooter(meta.button, liffUrl(taskId)))
  };
}

export function sessionAnnouncementFlex(session) {
  const name = safeText(session.checkpoint_name || session.checkpointName, "Onboarding Session");
  const date = formatThaiDate(session.session_date || session.sessionDate);
  const start = safeText(session.start_time || session.startTime, "-");
  const end = safeText(session.end_time || session.endTime, "-");
  const room = safeText(session.room, "-");
  const monthNo = session.month_no || session.monthNo;
  const timeText = start === "-" && end === "-" ? "ยังไม่กำหนด" : `${start} - ${end}`;

  const header = brandHeader({
    eyebrow: "ประกาศรอบ Onboarding",
    tag: monthNo ? `Month ${monthNo}` : "Session",
    title: name
  });

  const rows = [calloutRow("วันนัดประชุม", date, COLOR.sageBg, COLOR.sageFg), kvRow("เวลา", timeText), kvRow("ห้อง", room)];

  return {
    type: "flex",
    altText: `Nose Tea: ${name} (${date})`,
    contents: bubble(header, rows, ctaFooter("เปิด HR Portal", liffUrl()))
  };
}

export function welcomeFlexMessage() {
  const header = brandHeader({
    tag: "ยินดีต้อนรับ",
    title: "ยินดีต้อนรับสู่ Nose Tea",
    subtitle: "ระบบดูแลการ Onboarding และการประเมินทดลองงาน"
  });
  return {
    type: "flex",
    altText: "ยินดีต้อนรับสู่ Nose Tea HR Portal",
    contents: bubble(
      header,
      [noteText("ขอบคุณที่เพิ่มเพื่อนกับเรา ระบบจะส่งการแจ้งเตือนงานและกำหนดส่งให้คุณผ่านแชทนี้ กดปุ่มด้านล่างเพื่อเริ่มต้นใช้งานได้เลย")],
      ctaFooter("เริ่มใช้งานระบบ", liffUrl())
    )
  };
}

export function previewFlexMessage(role) {
  const isMentor = role === "Mentor";
  return taskFlexMessage(
    {
      task_id: isMentor ? "PV-FB1" : "PV-R1",
      task_type: isMentor ? "Feedback" : "Reflection",
      title: isMentor ? "Month 1 - Mentor Feedback (Pimchanok S.)" : "Month 1 - Reflection",
      due_date: isMentor ? "2026-06-20" : "2026-06-29",
      month_no: 1,
      employee_name: isMentor ? "Pimchanok S." : "Self",
      status: "Pending"
    },
    { name: isMentor ? "Kitti P." : "New Hire" }
  );
}
