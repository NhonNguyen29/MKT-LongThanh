import { CheckCircle2, Clock } from "lucide-react";
import type { Task } from "@/lib/types";
import { hasAcknowledged } from "@/lib/task-receipt";

export function TaskReceipt({
  task,
  showTime = false,
}: {
  task: Task;
  showTime?: boolean;
}) {
  const received = hasAcknowledged(task);
  return (
    <span
      className={
        "receipt " +
        (!task.assignee ? "unassigned" : received ? "received" : "waiting")
      }
    >
      {received ? <CheckCircle2 size={14} /> : <Clock size={14} />}
      <span>
        {!task.assignee
          ? "Chưa giao"
          : received
            ? "Đã nhận việc"
            : "Chưa xác nhận nhận việc"}
        {received && showTime && (
          <small>
            {new Date(task.acknowledgedAt!).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              year: "numeric",
            })}
          </small>
        )}
      </span>
    </span>
  );
}
