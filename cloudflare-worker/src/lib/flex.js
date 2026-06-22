import { liffUrl } from "./core.js";

const TASK_META = {
  Feedback: {
    title: "ถึงเวลาประเมิน Feedback",
    tag: "Feedback",
    accent: "#8a3a12",
    button: "ให้ Feedback",
    targetLabel: "ผู้รับการประเมิน"
  },
  Attendance: {
    title: "ยืนยันการเข้าร่วม",
    tag: "Attendance",
    accent: "#2f613b",
    button: "ยืนยันการเข้าร่วม",
    targetLabel: "ประเภท"
  },
  Reflection: {
    title: "ถึงเวลาส่ง Reflection",
    tag: "Reflection",
    accent: "#173b75",
    button: "กรอก Reflection",
    targetLabel: "ประเภท"
  },
  Probation: {
    title: "ถึงรอบประเมินทดลองงาน",
    tag: "Probation",
    accent: "#5b3fd6",
    button: "เปิดแบบประเมิน",
    targetLabel: "พนักงาน"
  }
};

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function taskMeta(taskType) {
  return TASK_META[taskType] || {
    title: "มีงานที่ต้องดำเนินการ",
    tag: safeText(taskType, "Task"),
    accent: "#1f3d26",
    button: "เปิดงาน",
    targetLabel: "งาน"
  };
}

function infoBox(label, value, backgroundColor, color) {
  return {
    type: "box",
    layout: "vertical",
    cornerRadius: "14px",
    backgroundColor,
    paddingAll: "12px",
    flex: 1,
    contents: [
      { type: "text", text: label, color: "#60708a", size: "xs", align: "center", wrap: true },
      { type: "text", text: value, color, size: "sm", weight: "bold", align: "center", wrap: true }
    ]
  };
}

function statusRow(label, value, color = "#0b2442") {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, color: "#60708a", size: "sm", flex: 1 },
      { type: "text", text: value, color, weight: "bold", size: "sm", align: "end", flex: 2, wrap: true }
    ]
  };
}

export function reminderFlexMessage(message, buttonLabel = "เปิด HR Portal", taskId = "") {
  return {
    type: "flex",
    altText: "Nose Tea HR Portal Reminder",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#1f3d26",
            paddingAll: "22px",
            contents: [
              { type: "separator", color: "#d6b75a", margin: "none" },
              { type: "text", text: "Nose Tea HR Portal", color: "#ffffff", weight: "bold", size: "xl", margin: "xl", wrap: true },
              { type: "text", text: safeText(message, "มีงานที่ต้องตรวจสอบใน HR Portal"), color: "#f5dec0", size: "md", margin: "md", wrap: true }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            spacing: "sm",
            contents: [
              { type: "text", text: "กดปุ่มด้านล่างเพื่อเปิด HR Portal และดูงานของคุณ", color: "#60708a", size: "sm", wrap: true }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#79a177",
            action: { type: "uri", label: buttonLabel, uri: liffUrl(taskId) }
          }
        ]
      }
    }
  };
}

export function taskFlexMessage(task, user = {}) {
  const taskType = task.task_type || task.taskType || "Task";
  const meta = taskMeta(taskType);
  const taskId = task.task_id || task.taskId || "";
  const due = safeText(task.due_date || task.dueDate, "ยังไม่กำหนด");
  const month = task.month_no || task.monthNo ? `Month ${task.month_no || task.monthNo}` : safeText(task.session_date || task.sessionDate, "รอบปัจจุบัน");
  const target = safeText(
    task.employee_name || task.target_name || task.employeeName || (taskType === "Feedback" ? "Mentee" : user.name || user.display_name),
    "Self"
  );
  const subtitle = safeText(task.title, "Nose Tea HR Task");
  const moduleName = taskType === "Probation" ? "Probation" : "Onboarding";

  return {
    type: "flex",
    altText: `Nose Tea HR Portal: ${meta.title}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: meta.accent,
            paddingAll: "22px",
            contents: [
              { type: "separator", color: "#d6b75a", margin: "none" },
              { type: "text", text: meta.title, color: "#ffffff", weight: "bold", size: "xxl", margin: "xxl", wrap: true },
              { type: "text", text: subtitle, color: "#f5dec0", size: "md", margin: "md", wrap: true },
              { type: "text", text: `# ${meta.tag}`, color: "#ffe7a7", weight: "bold", size: "sm", margin: "md" }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            spacing: "md",
            contents: [
              {
                type: "box",
                layout: "horizontal",
                spacing: "md",
                contents: [
                  infoBox(meta.targetLabel, taskType === "Feedback" || taskType === "Probation" ? target : meta.tag, "#e8f2ff", "#1d4e89"),
                  infoBox("รอบ", month, "#fff4c7", "#92400e"),
                  infoBox("กำหนดส่ง", due, "#f3f4f6", "#334155")
                ]
              },
              statusRow("สถานะ", safeText(task.status, "Pending"), "#d97706"),
              statusRow("ระบบ", moduleName)
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#79a177",
            action: { type: "uri", label: meta.button, uri: liffUrl(taskId) }
          }
        ]
      }
    }
  };
}

export function previewFlexMessage(role) {
  const isMentor = role === "Mentor";
  return taskFlexMessage({
    task_id: isMentor ? "PV-FB1" : "PV-R1",
    task_type: isMentor ? "Feedback" : "Reflection",
    title: isMentor ? "Month 1 - Mentor Feedback (Pimchanok S.)" : "Month 1 - Reflection",
    due_date: isMentor ? "2026-06-20" : "2026-06-29",
    month_no: 1,
    employee_name: isMentor ? "Pimchanok S." : "Self",
    status: "Pending"
  }, {
    name: isMentor ? "Kitti P." : "New Hire"
  });
}
