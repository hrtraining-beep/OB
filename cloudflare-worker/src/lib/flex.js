import { liffUrl } from "./core.js";

export function reminderFlexMessage(message, buttonLabel = "เปิด Nose Tea LIFF", taskId = "") {
  return {
    type: "flex",
    altText: "Nose Tea Onboarding Reminder",
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
              {
                type: "text",
                text: "Nose Tea Onboarding",
                color: "#ffffff",
                weight: "bold",
                size: "xl",
                margin: "xl",
                wrap: true
              },
              {
                type: "text",
                text: message,
                color: "#f5dec0",
                size: "md",
                margin: "md",
                wrap: true
              }
            ]
          },
          {
            type: "box",
            layout: "vertical",
            paddingAll: "16px",
            spacing: "sm",
            contents: [
              { type: "text", text: "กดปุ่มด้านล่างเพื่อเปิด LIFF และดูงานของคุณ", color: "#60708a", size: "sm", wrap: true },
              { type: "text", text: liffUrl(taskId), color: "#163b73", size: "xs", wrap: true }
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
            action: {
              type: "uri",
              label: buttonLabel,
              uri: liffUrl(taskId)
            }
          }
        ]
      }
    }
  };
}

export function taskFlexMessage(task, user) {
  const taskType = task.task_type || task.taskType || "Task";
  const isFeedback = taskType === "Feedback";
  const isAttendance = taskType === "Attendance";
  const title = isFeedback ? "รอให้ Feedback" : (isAttendance ? "ยืนยันการเข้าร่วม" : "ถึงเวลาส่ง Reflection");
  const subtitle = task.title || "Nose Tea Onboarding Task";
  const taskId = task.task_id || task.taskId;
  const due = task.due_date || task.dueDate || "-";
  const accent = isFeedback ? "#84360f" : (isAttendance ? "#315f39" : "#14356f");
  const buttonText = isFeedback ? "ให้ Feedback" : (isAttendance ? "ยืนยัน" : "กรอก Reflection");
  const target = task.employee_name || task.target_name || (isFeedback ? "Mentee" : user.name) || "Self";

  return {
    type: "flex",
    altText: `Nose Tea Onboarding: ${title}`,
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
            backgroundColor: accent,
            paddingAll: "22px",
            contents: [
              { type: "separator", color: "#d6b75a", margin: "none" },
              { type: "text", text: title, color: "#ffffff", weight: "bold", size: "xxl", margin: "xxl", wrap: true },
              { type: "text", text: subtitle, color: "#f5dec0", size: "md", margin: "md", wrap: true },
              { type: "text", text: `# ${taskType}`, color: "#ffe7a7", weight: "bold", size: "sm", margin: "md" }
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
                  {
                    type: "box",
                    layout: "vertical",
                    cornerRadius: "14px",
                    backgroundColor: "#e8f2ff",
                    paddingAll: "12px",
                    flex: 1,
                    contents: [
                      { type: "text", text: isFeedback ? "ผู้ถูกประเมิน" : "ประเภท", color: "#60708a", size: "xs", align: "center" },
                      { type: "text", text: isFeedback ? target : taskType, color: "#1d4e89", size: "sm", weight: "bold", align: "center", wrap: true }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    cornerRadius: "14px",
                    backgroundColor: "#fff4c7",
                    paddingAll: "12px",
                    flex: 1,
                    contents: [
                      { type: "text", text: "จำนวน", color: "#60708a", size: "xs", align: "center" },
                      { type: "text", text: "1 งาน", color: "#92400e", size: "md", weight: "bold", align: "center" }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    cornerRadius: "14px",
                    backgroundColor: "#f3f4f6",
                    paddingAll: "12px",
                    flex: 1,
                    contents: [
                      { type: "text", text: "กำหนดส่ง", color: "#60708a", size: "xs", align: "center" },
                      { type: "text", text: due, color: "#334155", size: "sm", weight: "bold", align: "center", wrap: true }
                    ]
                  }
                ]
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  { type: "text", text: "สถานะ", color: "#60708a", size: "sm", flex: 1 },
                  { type: "text", text: task.status || "Pending", color: "#d97706", weight: "bold", size: "sm", align: "end", flex: 1 }
                ]
              }
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
            action: { type: "uri", label: buttonText, uri: liffUrl(taskId) }
          }
        ]
      }
    }
  };
}

export function previewFlexMessage(role) {
  const isMentor = role === "Mentor";
  const title = isMentor ? "รอให้ Feedback" : "ถึงเวลาส่ง Reflection";
  const subtitle = isMentor ? "Pimchanok S. · Month 1 Feedback Form" : "Reflection Month 1 · New Hire Journey";
  const taskId = isMentor ? "PV-FB1" : "PV-R1";
  const accent = isMentor ? "#84360f" : "#14356f";
  const buttonText = isMentor ? "ให้ Feedback" : "กรอก Reflection";

  return {
    type: "flex",
    altText: `Nose Tea Onboarding: ${title}`,
    contents: {
      type: "bubble",
      size: "mega",
      styles: {
        body: { backgroundColor: "#ffffff" },
        footer: { backgroundColor: "#ffffff" }
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: accent,
            paddingAll: "22px",
            contents: [
              { type: "separator", color: "#d6b75a", margin: "none" },
              { type: "text", text: title, color: "#ffffff", weight: "bold", size: "xxl", margin: "xxl", wrap: true },
              { type: "text", text: subtitle, color: "#f5dec0", size: "md", margin: "md", wrap: true },
              { type: "text", text: `# ${isMentor ? "Feedback" : "Reflection"}`, color: "#ffe7a7", weight: "bold", size: "sm", margin: "md" }
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
                  {
                    type: "box",
                    layout: "vertical",
                    cornerRadius: "14px",
                    backgroundColor: "#e8f2ff",
                    paddingAll: "12px",
                    flex: 1,
                    contents: [
                      { type: "text", text: isMentor ? "ผู้ถูกประเมิน" : "ประเภท", color: "#60708a", size: "xs", align: "center" },
                      { type: "text", text: isMentor ? "Pimchanok" : "Reflection", color: "#1d4e89", size: "md", weight: "bold", align: "center", wrap: true }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    cornerRadius: "14px",
                    backgroundColor: "#fff4c7",
                    paddingAll: "12px",
                    flex: 1,
                    contents: [
                      { type: "text", text: "จำนวน", color: "#60708a", size: "xs", align: "center" },
                      { type: "text", text: "1 งาน", color: "#92400e", size: "md", weight: "bold", align: "center" }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    cornerRadius: "14px",
                    backgroundColor: "#f3f4f6",
                    paddingAll: "12px",
                    flex: 1,
                    contents: [
                      { type: "text", text: "กำหนดส่ง", color: "#60708a", size: "xs", align: "center" },
                      { type: "text", text: isMentor ? "20/06/2569" : "29/06/2569", color: "#334155", size: "md", weight: "bold", align: "center" }
                    ]
                  }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: "สถานะ", color: "#60708a", size: "sm", flex: 1 },
                      { type: "text", text: "Pending", color: "#d97706", weight: "bold", size: "sm", align: "end", flex: 1 }
                    ]
                  },
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      { type: "text", text: "ระบบ", color: "#60708a", size: "sm", flex: 1 },
                      { type: "text", text: "Nose Tea Onboarding", color: "#0b2442", weight: "bold", size: "sm", align: "end", flex: 2 }
                    ]
                  }
                ]
              }
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
            action: {
              type: "uri",
              label: buttonText,
              uri: liffUrl(taskId)
            }
          }
        ]
      }
    }
  };
}
