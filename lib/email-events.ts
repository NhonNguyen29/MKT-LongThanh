import { randomUUID } from "node:crypto";
import type { EmailEvent, State, Task, User } from "./types";
import { canSee } from "./permissions";
import { vietnamDate } from "./calendar";
export function enqueueEmail(
  state: State,
  event: Pick<EmailEvent, "key" | "kind" | "recipientId" | "taskId">,
  now = new Date(),
) {
  const log = (state.emailLog ??= []);
  const existing = log.find((e) => e.key === event.key);
  if (existing) return existing.id;
  const item: EmailEvent = {
    ...event,
    id: randomUUID(),
    status: "pending",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  log.unshift(item);
  state.emailLog = log.filter(
    (e) =>
      e.status === "pending" ||
      e.status === "sending" ||
      Date.parse(e.updatedAt) > now.getTime() - 7 * 86400000,
  );
  return item.id;
}
export function queueTaskEmails(
  state: State,
  actor: User,
  before: Task | undefined,
  task: Task,
) {
  const ids: string[] = [];
  const add = (kind: EmailEvent["kind"], user: User) =>
    ids.push(
      enqueueEmail(state, {
        key: `${kind}:${task.id}:${task.version}:${user.id}`,
        kind,
        recipientId: user.id,
        taskId: task.id,
      }),
    );
  if (task.archived) return ids;
  const assignee = state.users.find((u) => u.active && u.id === task.assignee);
  if (assignee && task.assignee !== before?.assignee) add("assigned", assignee);
  if (task.status !== before?.status) {
    if (task.status === "review")
      for (const admin of state.users.filter(
        (u) => u.active && u.role !== "employee" && u.id !== actor.id,
      ))
        add("review", admin);
    if (
      assignee &&
      assignee.id !== actor.id &&
      (task.status === "changes" || task.status === "done")
    )
      add(task.status, assignee);
  }
  return ids;
}
export function reminderTasks(state: State, user: User) {
  return state.tasks.filter(
    (t) =>
      !t.archived &&
      t.assignee === user.id &&
      canSee(user, t) &&
      !["done", "paused", "review"].includes(t.status),
  );
}
export function queueReminders(
  state: State,
  kind: "daily" | "manual",
  now = new Date(),
) {
  const ids: string[] = [];
  for (const user of state.users.filter((u) => u.active && u.email)) {
    if (!reminderTasks(state, user).length) continue;
    const slot =
      kind === "daily" ? vietnamDate(now) : Math.floor(now.getTime() / 300000);
    ids.push(
      enqueueEmail(
        state,
        { key: `${kind}:${slot}:${user.id}`, kind, recipientId: user.id },
        now,
      ),
    );
  }
  return ids;
}
export function claimEmail(state: State, id: string, now = new Date()) {
  const event = state.emailLog?.find((e) => e.id === id);
  if (!event || event.status !== "pending") return null;
  const recipient = state.users.find(
    (u) => u.id === event.recipientId && u.active,
  );
  const task = state.tasks.find((t) => t.id === event.taskId);
  let tasks: Task[] = [];
  if (recipient) {
    if (event.kind === "daily" || event.kind === "manual")
      tasks = reminderTasks(state, recipient);
    else if (task && !task.archived && canSee(recipient, task)) {
      const valid =
        event.kind === "review"
          ? recipient.role !== "employee" && task.status === "review"
          : task.assignee === recipient.id &&
            (event.kind === "assigned" || task.status === event.kind);
      if (valid) tasks = [task];
    }
  }
  if (!recipient || (!tasks.length && event.kind !== "test")) {
    event.status = "skipped";
    event.error =
      "Không còn công việc phù hợp hoặc người nhận không còn quyền truy cập.";
    event.updatedAt = now.toISOString();
    return null;
  }
  event.status = "sending";
  event.updatedAt = now.toISOString();
  delete event.error;
  return {
    event: structuredClone(event),
    recipient: {
      id: recipient.id,
      name: recipient.name,
      email: recipient.email,
    },
    tasks: structuredClone(tasks),
  };
}
export function finishEmail(
  state: State,
  id: string,
  success: boolean,
  error?: string,
) {
  const e = state.emailLog?.find((e) => e.id === id);
  if (!e || e.status !== "sending") return;
  e.status = success ? "sent" : "failed";
  e.updatedAt = new Date().toISOString();
  e.error = error;
}
