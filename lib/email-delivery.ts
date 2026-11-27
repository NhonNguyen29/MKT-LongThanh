import { transact } from "./store";
import { claimEmail, finishEmail } from "./email-events";
import { isGmailConfigured, safeMailError, sendGmail } from "./mailer";
export async function deliverEmails(ids: string[]) {
  const result = {
    sent: 0,
    failed: 0,
    skipped: 0,
    configured: isGmailConfigured(),
  };
  if (!result.configured) return result;
  const remaining = [...new Set(ids)];
  await Promise.all(
    [0, 1].map(async () => {
      while (remaining.length) {
        const id = remaining.shift()!;
        const claimed = await transact((s) => claimEmail(s, id));
        if (!claimed) {
          result.skipped++;
          continue;
        }
        try {
          await sendGmail(claimed.recipient, claimed.event.kind, claimed.tasks);
          await transact((s) => finishEmail(s, id, true));
          result.sent++;
        } catch (error) {
          await transact((s) =>
            finishEmail(s, id, false, safeMailError(error)),
          );
          result.failed++;
        }
      }
    }),
  );
  return result;
}
