import test from "node:test";
import assert from "node:assert/strict";
import { seedTasks } from "../lib/seed";
import { vietnamDate, addDays } from "../lib/calendar";
import {
  enqueueEmail,
  queueTaskEmails,
  queueReminders,
  claimEmail,
  finishEmail,
} from "../lib/email-events";
import { emailContent, safeMailError } from "../lib/mailer";
import { snapshot } from "../lib/service";
import { GET as cron } from "../app/api/cron/daily-reminder/route";
import { NextRequest } from "next/server";
import type { State, User } from "../lib/types";
const owner: User = {
  id: "owner",
  name: "Owner",
  email: "owner@example.test",
  role: "owner",
  active: true,
  passwordHash: "not-exposed",
};
const employee: User = {
  ...owner,
  id: "employee",
  name: "Employee",
  email: "employee@example.test",
  role: "employee",
};
function state(): State {
  const task = seedTasks()[0];
  Object.assign(task, {
    status: "doing",
    publication: "draft",
    assignee: employee.id,
    dueDate: vietnamDate(),
    archived: false,
  });
  return {
    schemaVersion: 1,
    users: [{ ...owner }, { ...employee }],
    tasks: [task],
    sessions: [],
    attempts: {},
    audit: [],
    readNotifications: {},
    settings: { reminderTime: "10:00", timezone: "Asia/Ho_Chi_Minh" },
  };
}
test("assignment events persist once and progress edits do not notify again", () => {
  const s = state(),
    task = s.tasks[0];
  const ids = queueTaskEmails(s, owner, undefined, task);
  assert.equal(ids.length, 1);
  assert.equal(s.emailLog![0].kind, "assigned");
  assert.equal(queueTaskEmails(s, owner, { ...task }, task).length, 0);
  queueTaskEmails(s, owner, undefined, task);
  assert.equal(s.emailLog!.length, 1);
  const claimed = claimEmail(s, ids[0]);
  assert.equal(claimed!.recipient.id, employee.id);
  assert.ok(!JSON.stringify(claimed).includes("passwordHash"));
  assert.equal(claimEmail(s, ids[0]), null);
  finishEmail(s, ids[0], true);
  assert.equal(s.emailLog![0].status, "sent");
  assert.equal(claimEmail(s, ids[0]), null);
});
test("review goes to managers; changes and acceptance go to assignee", () => {
  const s = state(),
    task = s.tasks[0];
  let before = structuredClone(task);
  task.status = "review";
  task.version++;
  queueTaskEmails(s, employee, before, task);
  assert.equal(s.emailLog![0].recipientId, owner.id);
  assert.equal(s.emailLog![0].kind, "review");
  before = structuredClone(task);
  task.status = "changes";
  task.version++;
  queueTaskEmails(s, owner, before, task);
  assert.equal(s.emailLog![0].recipientId, employee.id);
  assert.equal(s.emailLog![0].kind, "changes");
  before = structuredClone(task);
  task.status = "done";
  task.version++;
  queueTaskEmails(s, owner, before, task);
  assert.equal(s.emailLog![0].kind, "done");
});
test("daily messages deduplicate per recipient/day and respect current-week scope", () => {
  const s = state();
  const day = new Date();
  const a = queueReminders(s, "daily", day),
    b = queueReminders(s, "daily", day);
  assert.deepEqual(a, b);
  assert.equal(s.emailLog!.length, 1);
  s.tasks[0].dueDate = addDays(vietnamDate(), 14);
  assert.equal(claimEmail(s, a[0]), null);
  assert.equal(s.emailLog![0].status, "skipped");
  assert.equal(queueReminders(s, "manual", day).length, 0);
});
test("delivery rechecks assignment and active account; failures are never recorded as sent", () => {
  const s = state();
  const id = enqueueEmail(s, {
    key: "one",
    kind: "assigned",
    recipientId: employee.id,
    taskId: s.tasks[0].id,
  });
  s.tasks[0].assignee = owner.id;
  assert.equal(claimEmail(s, id), null);
  const testId = enqueueEmail(s, {
    key: "test",
    kind: "test",
    recipientId: owner.id,
  });
  assert.ok(claimEmail(s, testId));
  finishEmail(
    s,
    testId,
    false,
    safeMailError({ code: "EAUTH", message: "secret-do-not-print" }),
  );
  assert.equal(s.emailLog![0].status, "failed");
  assert.ok(!s.emailLog![0].error!.includes("secret"));
  s.users[0].active = false;
  const disabled = enqueueEmail(s, {
    key: "disabled",
    kind: "test",
    recipientId: owner.id,
  });
  assert.equal(claimEmail(s, disabled), null);
});
test("HTML content escapes task text and employees cannot read team email history", () => {
  const s = state();
  s.tasks[0].description = "<script>bad()</script>";
  const content = emailContent("assigned", "<img>", s.tasks);
  assert.ok(content.html.includes("&lt;script&gt;"));
  assert.ok(!content.html.includes("<script>"));
  enqueueEmail(s, { key: "private", kind: "test", recipientId: owner.id });
  assert.equal(snapshot(s, employee, "local", true).emailLog.length, 0);
  assert.equal(snapshot(s, owner, "local", true).emailLog.length, 1);
});
test("cron fails closed if the secret is missing or invalid", async () => {
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(
      (
        await cron(
          new NextRequest("https://example.test/api/cron/daily-reminder"),
        )
      ).status,
      401,
    );
    process.env.CRON_SECRET = "test-only-secret";
    assert.equal(
      (
        await cron(
          new NextRequest("https://example.test/api/cron/daily-reminder", {
            headers: { Authorization: "Bearer wrong" },
          }),
        )
      ).status,
      401,
    );
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
