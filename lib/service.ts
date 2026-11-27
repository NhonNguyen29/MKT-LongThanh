import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { State, User, Task, Snapshot, BuildStep } from "./types";
import {
  AppError,
  canManage,
  canSee,
  requireManage,
  validateCompletionProof,
  validatePublication,
} from "./permissions";
import { platforms, vietnamDate, weekStart, weeklyRotation } from "./calendar";
import { ensureRecurring } from "./seed";
import { hashPassword, tokenHash, verifyPassword } from "./security";
import { gmailSenderEmail, isGmailConfigured } from "./mailer";
import build from "@/data/build-progress.json";
const status = z.enum(["todo", "doing", "review", "changes", "done", "paused"]);
const patchSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    description: z.string().max(5000).optional(),
    priority: z.enum(["high", "normal", "low"]).optional(),
    status: status.optional(),
    assignee: z.string().nullable().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    progress: z.number().int().min(0).max(100).optional(),
    publication: z
      .enum(["draft", "approved", "delivered", "published"])
      .optional(),
    publishedUrl: z.string().max(1000).optional(),
    platform: z
      .enum(platforms.map((p) => p.name) as [string, ...string[]])
      .optional(),
    archived: z.boolean().optional(),
  })
  .strict();
function audit(state: State, user: User, message: string, taskId?: string) {
  state.audit.unshift({
    id: randomUUID(),
    actor: user.name,
    message,
    at: new Date().toISOString(),
    taskId,
  });
  state.audit = state.audit.slice(0, 1000);
}
export function currentUser(state: State, token: string | undefined) {
  if (!token) throw new AppError("Vui lòng đăng nhập.", 401);
  const s = state.sessions.find(
    (s) => s.hash === tokenHash(token) && s.expires > Date.now(),
  );
  const user = state.users.find((u) => u.id === s?.userId && u.active);
  if (!user) throw new AppError("Phiên đăng nhập đã hết hạn.", 401);
  return user;
}
export function mutate(state: State, user: User, input: unknown) {
  const envelope = z
    .object({ action: z.string(), payload: z.unknown() })
    .parse(input);
  if (envelope.action === "updateTask") {
    const p = z
      .object({ id: z.string(), version: z.number(), patch: patchSchema })
      .strict()
      .parse(envelope.payload);
    const task = state.tasks.find((t) => t.id === p.id);
    if (!task || !canSee(user, task))
      throw new AppError("Không tìm thấy công việc được phép truy cập.", 404);
    if (task.version !== p.version)
      throw new AppError(
        "Công việc vừa được cập nhật. Tải lại dữ liệu trước khi lưu.",
        409,
      );
    if (!canManage(user)) {
      if (
        Object.keys(p.patch).some(
          (k) => !["status", "progress", "publishedUrl"].includes(k),
        )
      )
        throw new AppError(
          "Nhân viên chỉ được cập nhật tiến độ, link bài viết và gửi duyệt.",
          403,
        );
      if (p.patch.status && !["doing", "review"].includes(p.patch.status))
        throw new AppError(
          "Nhân viên chỉ được chuyển Sang đang làm hoặc Chờ duyệt.",
          403,
        );
      if (
        task.archived ||
        task.status === "done" ||
        task.publication === "published"
      )
        throw new AppError(
          "Công việc đã nghiệm thu. Liên hệ quản lý để mở lại.",
          403,
        );
    }
    if (
      p.patch.assignee &&
      !state.users.some((u) => u.id === p.patch.assignee && u.active)
    )
      throw new AppError("Người phụ trách không hợp lệ.");
    if (p.patch.dueDate) {
      const d = new Date(p.patch.dueDate + "T00:00:00Z");
      if (
        !Number.isFinite(d.getTime()) ||
        d.toISOString().slice(0, 10) !== p.patch.dueDate
      )
        throw new AppError("Ngày đến hạn không hợp lệ.");
    }
    const next = { ...task, ...p.patch };
    if (typeof p.patch.publishedUrl === "string")
      next.publishedUrl = p.patch.publishedUrl.trim();
    if (
      p.patch.assignee !== undefined &&
      p.patch.assignee &&
      !next.week &&
      !next.dueDate
    ) {
      next.assignedWeek = weekStart(vietnamDate());
    }
    const enteringReview = next.status === "review" && task.status !== "review";
    const enteringDone = next.status === "done" && task.status !== "done";
    if (!canManage(user) && (enteringReview || enteringDone)) {
      validateCompletionProof(next, state);
    }
    if (next.status === "done") next.progress = 100;
    if (
      next.week &&
      state.tasks.some(
        (t) =>
          t.id !== next.id &&
          t.week === next.week &&
          t.platform === next.platform,
      )
    )
      throw new AppError("Ba bài trong tuần phải dùng ba nền tảng khác nhau.");
    if (next.week && next.archived)
      throw new AppError(
        "Giữ ba vị trí social của tuần; dùng trạng thái Tạm dừng thay vì lưu trữ.",
      );
    if (
      next.publication === "published" &&
      task.publication !== "published" &&
      !["approved", "delivered"].includes(task.publication)
    )
      throw new AppError(
        "Cần duyệt hoặc bàn giao nội dung trước khi ghi nhận xuất bản.",
      );
    validatePublication(next, state);
    next.publishedAt =
      next.publication === "published"
        ? (task.publishedAt ?? new Date().toISOString())
        : null;
    next.updatedAt = new Date().toISOString();
    next.version++;
    Object.assign(task, next);
    audit(state, user, "Cập nhật " + task.id + ": " + task.title, task.id);
    return;
  }
  if (envelope.action === "createTask") {
    requireManage(user);
    const p = z
      .object({
        title: z.string().trim().min(3).max(180),
        description: z.string().max(5000).default(""),
        channel: z.enum([
          "Facebook",
          "Google Maps",
          "TikTok",
          "Social",
          "YouTube",
          "SEO Website",
          "Thiết kế",
          "Kho Media",
          "Vận hành",
        ]),
        assignee: z.string().nullable().default(null),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .default(null),
        priority: z.enum(["high", "normal", "low"]).default("normal"),
        mediaFolder: z
          .object({
            year: z.number().int().min(2020).max(2040),
            month: z.number().int().min(1).max(12),
          })
          .nullable()
          .optional(),
      })
      .strict()
      .parse(envelope.payload);
    if (p.assignee && !state.users.some((u) => u.id === p.assignee && u.active))
      throw new AppError("Người phụ trách không hợp lệ.");
    if (
      p.dueDate &&
      new Date(p.dueDate + "T00:00:00Z").toISOString().slice(0, 10) !==
        p.dueDate
    )
      throw new AppError("Ngày không hợp lệ.");
    const t: Task = {
      ...p,
      id: "CV-" + randomUUID().slice(0, 8),
      status: "todo",
      publication: "draft",
      progress: 0,
      publishedUrl: "",
      publishedAt: null,
      assignedWeek: p.assignee && !p.dueDate ? weekStart(vietnamDate()) : null,
      proofImage: null,
      mediaFolder: p.mediaFolder ?? null,
      version: 1,
      archived: false,
      updatedAt: new Date().toISOString(),
      comments: [],
    };
    state.tasks.unshift(t);
    audit(state, user, "Tạo công việc " + t.title, t.id);
    return;
  }
  if (envelope.action === "comment") {
    const p = z
      .object({ id: z.string(), body: z.string().trim().min(1).max(2000) })
      .parse(envelope.payload);
    const task = state.tasks.find((t) => t.id === p.id);
    if (!task || !canSee(user, task))
      throw new AppError("Không tìm thấy công việc.", 404);
    task.comments.push({
      id: randomUUID(),
      author: user.name,
      body: p.body,
      at: new Date().toISOString(),
    });
    task.updatedAt = new Date().toISOString();
    audit(state, user, "Bình luận tại " + task.id, task.id);
    return;
  }
  if (envelope.action === "createUser") {
    if (user.role !== "owner")
      throw new AppError("Chỉ chủ trung tâm được tạo tài khoản.", 403);
    const p = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.email().max(150),
        role: z.enum(["manager", "employee"]),
        password: z.string().min(12).max(128),
      })
      .strict()
      .parse(envelope.payload);
    if (state.users.some((u) => u.email === p.email.toLowerCase()))
      throw new AppError("Email đã tồn tại.");
    state.users.push({
      id: randomUUID(),
      name: p.name,
      email: p.email.toLowerCase(),
      role: p.role,
      passwordHash: hashPassword(p.password),
      active: true,
    });
    audit(state, user, "Tạo tài khoản " + p.name + " (" + p.role + ")");
    return;
  }
  if (envelope.action === "updateUser") {
    if (user.role !== "owner")
      throw new AppError("Chỉ chủ trung tâm được đổi quyền.", 403);
    const p = z
      .object({
        id: z.string(),
        role: z.enum(["manager", "employee"]).optional(),
        active: z.boolean().optional(),
      })
      .strict()
      .parse(envelope.payload);
    const target = state.users.find((u) => u.id === p.id);
    if (!target || target.role === "owner")
      throw new AppError(
        "Không được thay đổi tài khoản chủ trung tâm tại đây.",
      );
    Object.assign(target, p);
    state.sessions = state.sessions.filter((s) => s.userId !== p.id);
    audit(state, user, "Cập nhật quyền/truy cập của " + target.name);
    return;
  }
  if (envelope.action === "readNotifications") {
    const p = z
      .object({ ids: z.array(z.string().max(180)).max(200) })
      .parse(envelope.payload);
    state.readNotifications[user.id] = [
      ...new Set([...(state.readNotifications[user.id] || []), ...p.ids]),
    ].slice(-1000);
    return;
  }
  if (envelope.action === "settings") {
    if (user.role !== "owner")
      throw new AppError("Chỉ chủ trung tâm được đổi lịch nhắc.", 403);
    const p = z
      .object({ reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })
      .strict()
      .parse(envelope.payload);
    state.settings.reminderTime = p.reminderTime;
    audit(state, user, "Đổi giờ nhắc trong web thành " + p.reminderTime);
    return;
  }
  if (envelope.action === "changePassword") {
    const p = z
      .object({
        oldPassword: z.string().max(128),
        newPassword: z.string().min(12).max(128),
      })
      .strict()
      .parse(envelope.payload);
    if (!verifyPassword(p.oldPassword, user.passwordHash))
      throw new AppError("Mật khẩu hiện tại chưa đúng.");
    user.passwordHash = hashPassword(p.newPassword);
    state.sessions = state.sessions.filter((s) => s.userId !== user.id);
    audit(state, user, "Đổi mật khẩu");
    return;
  }
  throw new AppError("Thao tác chưa được hỗ trợ.");
}
export function snapshot(
  state: State,
  user: User,
  storage: "local" | "postgres",
  localTest: boolean,
): Snapshot {
  ensureRecurring(state);
  const today = vietnamDate(),
    week = weekStart(today);
  const tasks = state.tasks.filter((t) => canSee(user, t));
  const read = state.readNotifications[user.id] || [];
  const notifications: Snapshot["notifications"] = [];
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  if (clock >= state.settings.reminderTime)
    notifications.push({
      id: "daily-" + today,
      title: "Bảng công việc hôm nay",
      body: "Rà việc đến hạn, phản hồi chờ duyệt và chỉ tiêu social tuần này.",
      read: read.includes("daily-" + today),
    });
  for (const t of tasks.filter(
    (t) => !t.archived && t.status !== "done" && t.status !== "paused",
  )) {
    if (t.dueDate && t.dueDate <= today) {
      const id = t.id + "-due-" + today;
      notifications.push({
        id,
        title: t.dueDate < today ? "Công việc quá hạn" : "Đến hạn hôm nay",
        body: t.title,
        taskId: t.id,
        read: read.includes(id),
      });
    }
    if (t.status === "review" && canManage(user)) {
      const id = t.id + "-review-" + t.version;
      notifications.push({
        id,
        title: "Nội dung chờ duyệt",
        body: t.title,
        taskId: t.id,
        read: read.includes(id),
      });
    }
  }
  const weekTasks = state.tasks.filter((t) => t.week === week);
  const completed = new Set(
    weekTasks
      .filter((t) => t.publication === "published" && t.publishedUrl)
      .map((t) => t.platform),
  ).size;
  const allMedia = state.mediaItems || [];
  const allowedFolders = new Set(
    tasks
      .filter((t) => t.mediaFolder)
      .map((t) => `${t.mediaFolder!.year}-${t.mediaFolder!.month}`),
  );
  const mediaItems = canManage(user)
    ? allMedia
    : allMedia.filter(
        (m) =>
          m.uploadedById === user.id ||
          allowedFolders.has(`${m.year}-${m.month}`),
      );
  return {
    user: (({ passwordHash, ...u }) => u)(user),
    users: state.users
      .map(({ passwordHash, ...u }) => u)
      .filter((u) => canManage(user) || u.id === user.id),
    tasks,
    mediaItems,
    audit: state.audit
      .filter((a) => canManage(user) || tasks.some((t) => t.id === a.taskId))
      .slice(0, 100),
    notifications,
    today,
    week,
    platforms,
    rotation: weeklyRotation(week),
    socialCompleted: completed,
    socialTarget: 3,
    build: canManage(user) ? (build as BuildStep[]) : [],
    settings: state.settings,
    storage,
    localTest,
    gmailConfigured: isGmailConfigured(),
    gmailSender: gmailSenderEmail(),
    emailLog: canManage(user)
      ? (state.emailLog || [])
          .slice(0, 30)
          .map((e) => ({
            ...e,
            recipientName:
              state.users.find((u) => u.id === e.recipientId)?.name ||
              "Tài khoản đã đóng",
          }))
      : [],
  };
}
