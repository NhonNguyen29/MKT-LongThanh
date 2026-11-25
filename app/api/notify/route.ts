import { NextRequest, NextResponse } from "next/server";
import { transact } from "@/lib/store";
import { currentUser } from "@/lib/service";
import { AppError, requireManage } from "@/lib/permissions";
import { sendDailyReminderEmails } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("origin") !== req.nextUrl.origin) {
      throw new AppError("Nguồn yêu cầu không hợp lệ.", 403);
    }
    const { state } = await transact((s) => {
      const user = currentUser(s, req.cookies.get("mkt_session")?.value);
      requireManage(user);
      return { state: structuredClone(s) };
    });

    const appUrl = req.nextUrl.origin;
    const result = await sendDailyReminderEmails(state, appUrl);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AppError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : "Không thể gửi email nhắc việc.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
