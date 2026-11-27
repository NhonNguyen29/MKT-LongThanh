import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { transact, storageMode } from "@/lib/store";
import { currentUser, mutate, snapshot } from "@/lib/service";
import { AppError } from "@/lib/permissions";
import { ensureRecurring } from "@/lib/seed";
import { queueTaskEmails } from "@/lib/email-events";
import { deliverEmails } from "@/lib/email-delivery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
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
    let emailIds: string[] = [];
    const result = await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      ensureRecurring(s);
      const prevTask =
        input?.action === "updateTask" && input?.payload?.id
          ? structuredClone(s.tasks.find((t) => t.id === input.payload.id))
          : undefined;
      mutate(s, user, input);
      if (input?.action === "createTask") {
        const created = s.tasks[0];
        if (created) emailIds = queueTaskEmails(s, user, undefined, created);
      } else if (input?.action === "updateTask" && input?.payload?.id) {
        const updated = s.tasks.find((t) => t.id === input.payload.id);
        if (updated) emailIds = queueTaskEmails(s, user, prevTask, updated);
      }
      return { ok: true };
    });
    // The task and outbox are committed first. An SMTP failure must not undo the task.
    const email = emailIds.length
      ? await deliverEmails(emailIds).catch(() => ({
          sent: 0,
          failed: emailIds.length,
          skipped: 0,
          configured: true,
        }))
      : undefined;
    return NextResponse.json({ ...result, email });
  } catch (e) {
    return error(e);
  }
}
