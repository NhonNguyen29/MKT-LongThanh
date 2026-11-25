import test from "node:test";
import assert from "node:assert/strict";
import { prepareProduction } from "../lib/production-import";
import { seedTasks } from "../lib/seed";
import { verifyPassword } from "../lib/security";
import type { State } from "../lib/types";

function local(): State {
  return {
    schemaVersion: 1,
    users: [
      {
        id: "owner",
        role: "owner",
        name: "Owner",
        email: "admin@saoviet.local",
        active: true,
        passwordHash: "old-local-hash",
      },
      {
        id: "test-employee",
        role: "employee",
        name: "TEST",
        email: "test@saoviet.local",
        active: true,
        passwordHash: "test",
      },
    ],
    tasks: seedTasks(),
    sessions: [
      { hash: "old-token", userId: "owner", expires: Date.now() + 10000 },
    ],
    attempts: { old: { count: 1, until: 1 } },
    audit: [],
    readNotifications: { owner: ["read"] },
    settings: { reminderTime: "10:00", timezone: "Asia/Ho_Chi_Minh" },
  };
}
test("production import copies work, removes TEST identities and invalidates local secrets", () => {
  const source = local();
  source.tasks[0].assignee = "test-employee";
  const copy = prepareProduction(
    source,
    "Owner@example.com",
    "production-test-password",
  );
  assert.equal(copy.users.length, 1);
  assert.equal(copy.users[0].email, "owner@example.com");
  assert.ok(
    verifyPassword("production-test-password", copy.users[0].passwordHash),
  );
  assert.notEqual(copy.users[0].passwordHash, source.users[0].passwordHash);
  assert.equal(copy.tasks.length, source.tasks.length);
  assert.equal(copy.tasks[0].assignee, null);
  assert.equal(copy.sessions.length, 0);
  assert.deepEqual(copy.attempts, {});
  assert.deepEqual(copy.readNotifications, {});
  assert.equal(source.sessions.length, 1);
  assert.equal(source.users.length, 2);
  assert.equal(source.tasks[0].assignee, "test-employee");
});
test("production import rejects placeholder owner email and weak password", () => {
  assert.throws(() =>
    prepareProduction(
      local(),
      "admin@saoviet.local",
      "production-test-password",
    ),
  );
  assert.throws(() => prepareProduction(local(), "owner@example.com", "short"));
});
