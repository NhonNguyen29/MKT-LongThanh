import { NextRequest, NextResponse } from "next/server";
import { transact } from "@/lib/store";
import { queueReminders } from "@/lib/email-events";
import { deliverEmails } from "@/lib/email-delivery";
import { isGmailConfigured } from "@/lib/mailer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isGmailConfigured())
    return NextResponse.json({ ok: false, skipped: "Gmail is not configured" });
  try {
    const ids = await transact((s) => {
      queueReminders(s, "daily");
      return (s.emailLog || [])
        .filter((e) => e.status === "pending")
        .reverse()
        .slice(0, 20)
        .map((e) => e.id);
    });
    const result = await deliverEmails(ids);
    return NextResponse.json({ ok: result.failed === 0, ...result });
  } catch {
    return NextResponse.json(
      {
        error:
          "Email reminder run failed; inspect email history before retrying.",
      },
      { status: 503 },
    );
  }
}
