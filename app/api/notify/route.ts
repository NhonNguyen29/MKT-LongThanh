import { NextRequest, NextResponse } from "next/server";
import { transact } from "@/lib/store";
import { currentUser } from "@/lib/service";
import { AppError, requireManage } from "@/lib/permissions";
import { enqueueEmail, queueReminders } from "@/lib/email-events";
import { deliverEmails } from "@/lib/email-delivery";
import { isGmailConfigured } from "@/lib/mailer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin)
      throw new AppError("Nguồn yêu cầu không hợp lệ.", 403);
    const body = await req.json().catch(() => ({ mode: "manual" }));
    const ids = await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      requireManage(user);
      if (!isGmailConfigured())
        throw new AppError("Chưa cấu hình App Password Gmail trên máy chủ.");
      if (body.mode === "test")
        return [
          enqueueEmail(s, {
            key: `test:${user.id}:${Math.floor(Date.now() / 60000)}`,
            kind: "test",
            recipientId: user.id,
          }),
        ];
      if (body.mode === "retry") {
        if (user.role !== "owner")
          throw new AppError("Chỉ chủ trung tâm được gửi lại email lỗi.", 403);
        const event = s.emailLog?.find((e) => e.id === body.id);
        if (!event || !["pending", "failed"].includes(event.status))
          throw new AppError("Email này không ở trạng thái chờ hoặc lỗi.");
        if (
          event.status === "failed" &&
          Date.now() - Date.parse(event.updatedAt) < 60000
        )
          throw new AppError("Chờ ít nhất một phút trước khi gửi lại.");
        event.status = "pending";
        return [event.id];
      }
      if (body.mode && body.mode !== "manual")
        throw new AppError("Thao tác không hợp lệ.");
      return queueReminders(s, "manual");
    });
    return NextResponse.json({ ok: true, ...(await deliverEmails(ids)) });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Chưa thể gửi email. Công việc đã lưu vẫn được giữ nguyên.",
      },
      { status: e instanceof AppError ? e.status : 503 },
    );
  }
}
