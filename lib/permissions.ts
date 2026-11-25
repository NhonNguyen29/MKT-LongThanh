import type { State, Task, User } from "./types";
import { vietnamDate, weekStart } from "./calendar";
export const canManage = (u: User) =>
  u.role === "owner" || u.role === "manager";
export function isTaskInWeek(t: Task, currentWeek = weekStart(vietnamDate())) {
  if (t.week) return t.week === currentWeek;
  if (t.dueDate) return weekStart(t.dueDate) === currentWeek;
  if (t.assignedWeek) return t.assignedWeek === currentWeek;
  return false;
}
export const canSee = (
  u: User,
  t: Task,
  currentWeek = weekStart(vietnamDate()),
) => canManage(u) || (t.assignee === u.id && isTaskInWeek(t, currentWeek));
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function requireManage(u: User) {
  if (!canManage(u))
    throw new AppError("Bạn không có quyền quản lý công việc này.", 403);
}
export function validateProofUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed)
    throw new AppError(
      "Bắt buộc nhập link bài viết (https://...) trước khi gửi duyệt hoặc xác thực hoàn thành.",
    );
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AppError("Link bài viết không hợp lệ.");
  }
  if (url.protocol !== "https:")
    throw new AppError("Link bài viết phải bắt đầu bằng https://.");
  return url;
}
export function validateCompletionProof(t: Task) {
  if (!t.proofImage?.url)
    throw new AppError(
      "Bắt buộc tải lên hình chụp màn hình công việc trước khi gửi duyệt hoặc xác thực hoàn thành.",
    );
  validateProofUrl(t.publishedUrl || "");
}
export function validatePublication(t: Task, state: State) {
  if (t.publication === "published") {
    if (!t.publishedUrl)
      throw new AppError("Cần URL bài đã đăng để xác minh xuất bản.");
    let url: URL;
    try {
      url = new URL(t.publishedUrl);
    } catch {
      throw new AppError("URL bài đăng không hợp lệ.");
    }
    if (url.protocol !== "https:")
      throw new AppError("URL xác minh phải bắt đầu bằng https://.");
    if (t.week) {
      if (!t.platform) throw new AppError("Cần chọn nền tảng cho bài social.");
      const hosts: Record<string, string[]> = {
        Hashnode: ["hashnode.com", "hashnode.dev"],
        Gravatar: ["gravatar.com"],
        LinkedIn: ["linkedin.com"],
        Instagram: ["instagram.com"],
        Pinterest: ["pinterest.com", "pin.it"],
        Tumblr: ["tumblr.com"],
        Threads: ["threads.com", "threads.net"],
        X: ["x.com", "twitter.com"],
        Dribbble: ["dribbble.com"],
        Diigo: ["diigo.com"],
        Instapaper: ["instapaper.com"],
      };
      if (
        !(hosts[t.platform] || []).some(
          (h) => url.hostname === h || url.hostname.endsWith("." + h),
        )
      )
        throw new AppError("URL chưa khớp nền tảng social đã chọn.");
      if (
        state.tasks.some(
          (x) =>
            x.id !== t.id &&
            x.week === t.week &&
            x.publication === "published" &&
            x.publishedUrl === t.publishedUrl,
        )
      )
        throw new AppError("URL này đã được ghi nhận cho bài khác trong tuần.");
    }
  }
}
