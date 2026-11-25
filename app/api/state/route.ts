import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { transact, storageMode } from "@/lib/store";
import { currentUser, mutate, snapshot } from "@/lib/service";
import { AppError } from "@/lib/permissions";
import { ensureRecurring } from "@/lib/seed";
import { sendTaskAssignedEmail } from "@/lib/mailer";
import type { Task, User } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function error(e: unknown) {
  if (e instanceof AppError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError)
    return NextResponse.json(
      {
        error:
          "Dữ liệu chưa hợp lệ. Kiểm tra các trường bắt buộc, email, mật khẩu và ngày.",
      },
      { status: 400 },
    );
  console.error("State error:", e instanceof Error ? e.name : "unknown");
  return NextResponse.json(
    { error: "Không thể lưu/tải dữ liệu. Kiểm tra cấu hình cơ sở dữ liệu." },
    { status: 503 },
  );
}
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(
      await transact((s) =>
        snapshot(
          s,
          currentUser(s, req.cookies.get("mkt_session")?.value),
          storageMode(),
          !process.env.VERCEL &&
            process.env.NODE_ENV !== "production" &&
            process.env.LOCAL_TEST_LOGIN === "true",
        ),
      ),
    );
  } catch (e) {
    return error(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      throw new AppError("Nguồn yêu cầu không hợp lệ.", 403);
    const input = await req.json();
    let notifyPair: { recipient: User; task: Task } | null = null;
    const result = await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      ensureRecurring(s);
      const prevTask =
        input?.action === "updateTask" && input?.payload?.id
          ? s.tasks.find((t) => t.id === input.payload.id)
          : undefined;
      const prevAssignee = prevTask?.assignee ?? null;
      mutate(s, user, input);
      if (input?.action === "createTask") {
        const created = s.tasks[0];
        if (created?.assignee) {
          const recipient = s.users.find((u) => u.id === created.assignee && u.active);
          if (recipient) notifyPair = { recipient: { ...recipient }, task: { ...created } };
        }
      } else if (input?.action === "updateTask" && input?.payload?.id) {
        const updated = s.tasks.find((t) => t.id === input.payload.id);
        if (updated?.assignee && updated.assignee !== prevAssignee) {
          const recipient = s.users.find((u) => u.id === updated.assignee && u.active);
          if (recipient) notifyPair = { recipient: { ...recipient }, task: { ...updated } };
        }
      }
      return { ok: true };
    });
    if (notifyPair) {
      const { recipient, task } = notifyPair;
      sendTaskAssignedEmail(recipient, task, req.nextUrl.origin).catch((err) => {
        console.error("Gmail notify failed:", err instanceof Error ? err.message : "unknown");
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return error(e);
  }
}
