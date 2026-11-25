import { NextRequest, NextResponse } from "next/server";
import { transact } from "@/lib/store";
import { sendDailyReminderEmails, isGmailConfigured } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  if (!isGmailConfigured()) {
    return NextResponse.json({ ok: false, skipped: "GMAIL_APP_PASSWORD not configured" });
  }
  const state = await transact((s) => structuredClone(s));
  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : req.nextUrl.origin);
  const res = await sendDailyReminderEmails(state, appUrl);
  return NextResponse.json({ ok: true, ...res });
}
