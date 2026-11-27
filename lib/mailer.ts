import nodemailer from "nodemailer";
import type { EmailEvent, Task } from "./types";
export const EMAIL_REMINDER_TIME = "09:00";
export const gmailSenderEmail = () =>
  (process.env.GMAIL_USER || "nhonnguyen2901@gmail.com").trim();
export const isGmailConfigured = () =>
  Boolean(gmailSenderEmail() && process.env.GMAIL_APP_PASSWORD?.trim());
export function emailAppUrl() {
  return process.env.APP_URL || "https://mkt-longthanh.vercel.app";
}
export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const titles: Record<EmailEvent["kind"], string> = {
  assigned: "Bạn được giao công việc",
  review: "Có kết quả đang chờ duyệt",
  changes: "Công việc cần chỉnh sửa",
  done: "Công việc đã được nghiệm thu",
  daily: "Nhắc việc hằng ngày",
  manual: "Nhắc tiến độ công việc",
  test: "Kiểm tra kết nối Gmail",
};
export function emailContent(
  kind: EmailEvent["kind"],
  name: string,
  tasks: Task[],
  appUrl = emailAppUrl(),
) {
  const title = titles[kind];
  const details = tasks
    .map(
      (t) =>
        `${t.id} · ${t.title}\nKênh: ${t.channel} | Hạn: ${t.dueDate || "Chưa đặt"}\n${t.description}`,
    )
    .join("\n\n");
  const content =
    kind === "test"
      ? "Đây là email kiểm tra kết nối từ hệ thống Marketing Sao Việt. Không có công việc mới được tạo."
      : details;
  return {
    subject: `[Sao Việt] ${title}${tasks.length === 1 ? ": " + tasks[0].title : ""}`,
    text: `Chào ${name},\n\n${title}\n\n${content}\n\nMở bảng công việc: ${appUrl}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#17213b;line-height:1.7"><div style="background:#1e3a8a;color:white;padding:20px;border-radius:12px"><strong>Tin Học Sao Việt · Long Thành</strong><h2>${escapeHtml(title)}</h2></div><p>Chào ${escapeHtml(name)},</p><div style="white-space:pre-wrap;background:#f5f7fc;padding:20px;border-radius:10px">${escapeHtml(content)}</div><p><a href="${escapeHtml(appUrl)}">Mở bảng công việc</a></p><small>Email tự động từ hệ thống điều hành Marketing.</small></div>`,
  };
}
export async function sendGmail(
  recipient: { email: string; name: string },
  kind: EmailEvent["kind"],
  tasks: Task[],
) {
  if (!isGmailConfigured())
    throw Object.assign(new Error("Missing Gmail configuration"), {
      code: "ENOCONFIG",
    });
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailSenderEmail(),
      pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s+/g, ""),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  const result = await transporter.sendMail({
    from: {
      name: "Tin Học Sao Việt · Long Thành",
      address: gmailSenderEmail(),
    },
    to: recipient.email,
    ...emailContent(kind, recipient.name, tasks),
  });
  if (!result.accepted?.length || result.rejected?.length)
    throw Object.assign(new Error("Recipient rejected"), {
      code: "ERECIPIENT",
    });
}
export function safeMailError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "EAUTH")
    return "Gmail từ chối xác thực. Kiểm tra địa chỉ gửi và App Password.";
  if (code === "ENOCONFIG") return "Chưa cấu hình App Password Gmail.";
  if (code === "ERECIPIENT") return "Gmail không chấp nhận địa chỉ người nhận.";
  return "Chưa xác nhận gửi thành công. Kiểm tra hộp thư trước khi gửi lại để tránh trùng email.";
}
