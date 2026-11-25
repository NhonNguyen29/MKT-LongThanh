import nodemailer from "nodemailer";
import type { State, Task, User } from "./types";

const DEFAULT_GMAIL_USER = "nhonnguyen2901@gmail.com";

export function gmailSenderEmail(): string {
  return (process.env.GMAIL_USER || DEFAULT_GMAIL_USER).trim();
}

export function isGmailConfigured(): boolean {
  return Boolean(gmailSenderEmail() && process.env.GMAIL_APP_PASSWORD?.trim());
}

function createTransport() {
  const user = gmailSenderEmail();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") || "";
  if (!user || !pass) {
    throw new Error("Chưa cấu hình GMAIL_APP_PASSWORD trên máy chủ.");
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function priorityLabel(p: Task["priority"]): string {
  if (p === "high") return "Cao";
  if (p === "low") return "Thấp";
  return "Bình thường";
}

export async function sendTaskAssignedEmail(
  recipient: User,
  task: Task,
  appUrl: string,
): Promise<boolean> {
  if (!isGmailConfigured() || !recipient.email) return false;
  const transporter = createTransport();
  const dueText = task.dueDate ? task.dueDate.split("-").reverse().join("/") : "Chưa đặt";
  const subject = `[Tin Học Sao Việt] Công việc mới: ${task.title}`;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111827;line-height:1.6;">
      <div style="background:#1e3a8a;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0;">
        <h2 style="margin:0;font-size:18px;">Tin Học Sao Việt · Long Thành</h2>
        <div style="font-size:13px;opacity:0.9;">Thông báo giao việc mới</div>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:22px;border-radius:0 0 12px 12px;background:#ffffff;">
        <p style="margin-top:0;">Chào <strong>${escapeHtml(recipient.name)}</strong>,</p>
        <p>Bạn vừa được giao công việc mới trên hệ thống điều hành Marketing:</p>
        <div style="background:#f8fafc;border-left:4px solid #2563eb;padding:14px 16px;border-radius:6px;margin:16px 0;">
          <div style="font-size:16px;font-weight:700;color:#1e3a8a;">${escapeHtml(task.title)}</div>
          <div style="font-size:13px;color:#4b5563;margin-top:6px;">
            <strong>Mã:</strong> ${escapeHtml(task.id)} &nbsp;|&nbsp;
            <strong>Kênh:</strong> ${escapeHtml(task.channel)} &nbsp;|&nbsp;
            <strong>Ưu tiên:</strong> ${priorityLabel(task.priority)} &nbsp;|&nbsp;
            <strong>Hạn:</strong> ${escapeHtml(dueText)}
          </div>
          ${task.description ? `<p style="margin:10px 0 0;font-size:14px;color:#1f2937;">${escapeHtml(task.description)}</p>` : ""}
        </div>
        <p style="margin:20px 0 0;">
          <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;">
            Mở bảng công việc
          </a>
        </p>
      </div>
    </div>
  `;
  await transporter.sendMail({
    from: `"Tin Học Sao Việt · Long Thành" <${gmailSenderEmail()}>`,
    to: recipient.email,
    subject,
    text: `Chào ${recipient.name},\n\nBạn vừa được giao công việc mới: ${task.title} (${task.id})\nKênh: ${task.channel} | Ưu tiên: ${priorityLabel(task.priority)} | Hạn: ${dueText}\n${task.description}\n\nMở bảng công việc: ${appUrl}`,
    html,
  });
  return true;
}

export async function sendDailyReminderEmails(
  state: State,
  appUrl: string,
): Promise<{ sent: number; recipients: string[] }> {
  if (!isGmailConfigured()) {
    throw new Error("Chưa cấu hình GMAIL_APP_PASSWORD trên Vercel.");
  }
  const transporter = createTransport();
  const activeUsers = state.users.filter((u) => u.active && u.role !== "owner" && u.email);
  const recipients: string[] = [];

  for (const emp of activeUsers) {
    const myTasks = state.tasks.filter(
      (t) =>
        !t.archived &&
        t.assignee === emp.id &&
        t.status !== "done" &&
        t.status !== "paused",
    );
    if (myTasks.length === 0) continue;

    const rowsHtml = myTasks
      .map((t) => {
        const due = t.dueDate ? t.dueDate.split("-").reverse().join("/") : "—";
        const pri =
          t.priority === "high"
            ? '<span style="color:#dc2626;font-weight:700;">Cao</span>'
            : priorityLabel(t.priority);
        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(t.id)}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
              <div style="font-weight:600;color:#111827;">${escapeHtml(t.title)}</div>
              ${t.description ? `<div style="font-size:12px;color:#4b5563;margin-top:3px;">${escapeHtml(t.description)}</div>` : ""}
            </td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${pri}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(due)}</td>
          </tr>`;
      })
      .join("");

    const subject = `[Nhắc việc ${state.settings.reminderTime}] Bạn có ${myTasks.length} công việc cần thực hiện · Tin Học Sao Việt`;
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;color:#111827;line-height:1.5;">
        <div style="background:#1e3a8a;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0;">
          <h2 style="margin:0;font-size:18px;">Nhắc việc hằng ngày · Tin Học Sao Việt Long Thành</h2>
          <div style="font-size:13px;opacity:0.9;">Lịch nhắc: ${escapeHtml(state.settings.reminderTime)} (giờ Việt Nam)</div>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:22px;border-radius:0 0 12px 12px;background:#ffffff;">
          <p style="margin-top:0;">Chào <strong>${escapeHtml(emp.name)}</strong>,</p>
          <p>Hiện tại bạn đang có <strong>${myTasks.length} công việc</strong> cần hoàn thành:</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin:14px 0;">
            <thead>
              <tr style="background:#f8fafc;text-align:left;">
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;">Mã</th>
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;">Công việc</th>
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;">Ưu tiên</th>
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;">Hạn</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <p style="margin:20px 0 0;">
            <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#1e3a8a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;">
              Mở hệ thống MKT Long Thành
            </a>
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Tin Học Sao Việt · Long Thành" <${gmailSenderEmail()}>`,
      to: emp.email,
      subject,
      text: `Chào ${emp.name},\n\nBạn có ${myTasks.length} công việc cần thực hiện:\n${myTasks.map((t) => `- [${t.id}] ${t.title} (Hạn: ${t.dueDate || "—"})`).join("\n")}\n\nMở bảng công việc: ${appUrl}`,
      html,
    });
    recipients.push(emp.email);
  }

  return { sent: recipients.length, recipients };
}
