import type { Task } from "./types";

export function hasAcknowledged(task: Task) {
  return Boolean(
    task.assignee &&
    task.acknowledgedBy === task.assignee &&
    task.acknowledgedAt,
  );
}

export type WorkFilter =
  "all" | "unassigned" | "unacknowledged" | "acknowledged" | "overdue";

export function matchesWorkFilter(
  task: Task,
  filter: WorkFilter,
  today: string,
) {
  if (filter === "all") return true;
  if (task.archived || task.status === "done" || task.status === "paused")
    return false;
  if (filter === "unassigned") return !task.assignee;
  if (filter === "unacknowledged")
    return Boolean(task.assignee) && !hasAcknowledged(task);
  if (filter === "acknowledged") return hasAcknowledged(task);
  return Boolean(task.dueDate && task.dueDate < today);
}
