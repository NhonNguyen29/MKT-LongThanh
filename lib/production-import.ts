import type { State } from "./types";
import { hashPassword } from "./security";

export function prepareProduction(
  source: State,
  email: string,
  password: string,
): State {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.endsWith(".local"))
    throw new Error("A real owner email is required");
  if (password.length < 16)
    throw new Error("Use a new production password of at least 16 characters");
  const state = structuredClone(source);
  const testIds = new Set(["test-manager", "test-employee"]);
  state.users = state.users.filter((u) => !testIds.has(u.id));
  const owner = state.users.find((u) => u.id === "owner" && u.role === "owner");
  if (!owner) throw new Error("Owner is missing in the source snapshot");
  owner.email = email.trim().toLowerCase();
  owner.passwordHash = hashPassword(password);
  owner.active = true;
  // Remove only the known disposable UI test from 25 November.
  state.tasks = state.tasks.filter(
    (t) =>
      t.id !== "CV-83c5629d" ||
      t.title !== "TEST · Kiểm tra giao việc và lưu tiến độ",
  );
  for (const task of state.tasks)
    if (task.assignee && testIds.has(task.assignee)) task.assignee = null;
  state.sessions = [];
  state.attempts = {};
  state.readNotifications = {};
  state.audit.unshift({
    id: "production-import-" + Date.now(),
    actor: "Hệ thống",
    message:
      "Chuyển dữ liệu local sang online; loại tài khoản TEST và thu hồi toàn bộ phiên local.",
    at: new Date().toISOString(),
  });
  return state;
}
