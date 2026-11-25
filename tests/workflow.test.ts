import test from "node:test";
import assert from "node:assert/strict";
import { seedTasks, ensureRecurring } from "../lib/seed";
import { mutate, snapshot, currentUser } from "../lib/service";
import {
  addDays,
  vietnamDate,
  weekStart,
  weeklyRotation,
} from "../lib/calendar";
import { tokenHash } from "../lib/security";
import type { State, User } from "../lib/types";
const owner: User = {
  id: "owner",
  name: "Owner",
  role: "owner",
  email: "owner@example.test",
  active: true,
  passwordHash: "unused",
};
const manager: User = { ...owner, id: "manager", role: "manager" };
const employee: User = { ...owner, id: "employee", role: "employee" };
function state(): State {
  return {
    schemaVersion: 1,
    users: [{ ...owner }, { ...manager }, { ...employee }],
    tasks: seedTasks(),
    sessions: [],
    attempts: {},
    audit: [],
    readNotifications: {},
    settings: { reminderTime: "10:00", timezone: "Asia/Ho_Chi_Minh" },
  };
}
function update(
  s: State,
  u: User,
  id: string,
  patch: object,
  version = s.tasks.find((t) => t.id === id)!.version,
) {
  mutate(s, u, { action: "updateTask", payload: { id, patch, version } });
}
test("VD05 merged into VD01; no imported post is marked published", () => {
  const s = state();
  assert.ok(!s.tasks.some((t) => t.id === "VD05"));
  assert.match(
    s.tasks.find((t) => t.id === "VD01")!.history!.join(" "),
    /VD05/,
  );
  assert.ok(s.tasks.every((t) => t.publication !== "published"));
});
test("Vietnam midnight, Monday weeks and rotation cover eleven platforms", () => {
  assert.equal(vietnamDate(new Date("2026-11-24T18:00Z")), "2026-11-25");
  assert.equal(weekStart("2026-11-29"), "2026-11-23");
  const seen = new Set<string>();
  for (let i = 0; i < 11; i++) {
    const week = weeklyRotation(addDays("2026-11-23", i * 7));
    assert.equal(new Set(week).size, 3);
    week.forEach((p) => seen.add(p));
  }
  assert.equal(seen.size, 11);
});
test("recurring generation is idempotent and preserves unfinished work", () => {
  const s = state();
  const date = new Date("2026-11-25T03:00Z");
  ensureRecurring(s, date);
  ensureRecurring(s, date);
  assert.equal(s.tasks.filter((t) => t.week === "2026-11-23").length, 3);
  assert.equal(s.tasks.filter((t) => t.id === "DK01-2026-11-25").length, 1);
  ensureRecurring(s, new Date("2026-12-01T03:00Z"));
  assert.ok(
    s.tasks.find((t) => t.id === "DK01-2026-11-25") &&
      !s.tasks.find((t) => t.id === "DK01-2026-11-25")!.archived,
  );
});
test("employee only sees assigned work in current week and requires screenshot + link for review/done", () => {
  const s = state();
  const thisWeek = weekStart(vietnamDate());
  update(s, manager, "VD01", { assignee: employee.id, dueDate: addDays(thisWeek, 2) });
  // Assign another task in NEXT week -> employee must NOT see it
  update(s, manager, "VD03", { assignee: employee.id, dueDate: addDays(thisWeek, 9) });
  assert.throws(() => update(s, employee, "VD02", { progress: 50 }), {
    status: 404,
  });
  assert.throws(() => update(s, employee, "VD03", { progress: 50 }), {
    status: 404,
  });
  for (const patch of [
    { assignee: manager.id },
    { publication: "approved" },
    { status: "done" },
    { title: "Changed" },
  ])
    assert.throws(() => update(s, employee, "VD01", patch), { status: 403 });
  update(s, employee, "VD01", { status: "doing", progress: 55 });
  assert.equal(s.tasks.find((t) => t.id === "VD01")!.progress, 55);
  // Submitting review without screenshot or URL must fail
  assert.throws(() => update(s, employee, "VD01", { status: "review" }), {
    status: 400,
  });
  // Attach proof image & URL -> now review succeeds
  s.tasks.find((t) => t.id === "VD01")!.proofImage = {
    url: "/api/assets/proof-VD01-test.png",
    name: "proof-VD01-test.png",
    uploadedAt: new Date().toISOString(),
  };
  assert.throws(() => update(s, employee, "VD01", { status: "review" }), {
    status: 400,
  });
  update(s, employee, "VD01", {
    status: "review",
    publishedUrl: "https://www.facebook.com/saoviet/posts/123",
  });
  const view = snapshot(s, employee, "local", true);
  assert.deepEqual(
    view.tasks.map((t) => t.id),
    ["VD01"],
  );
  assert.equal(view.users.length, 1);
  assert.equal(view.build.length, 0);
  assert.ok(!JSON.stringify(view).includes("passwordHash"));
});
test("manager can assign and accept work with proof but cannot manage accounts or reminder settings", () => {
  const s = state();
  const thisWeek = weekStart(vietnamDate());
  update(s, manager, "VD01", { assignee: employee.id, dueDate: addDays(thisWeek, 1) });
  // Cannot mark done without proof screenshot & link
  assert.throws(() => update(s, manager, "VD01", { status: "done" }), {
    status: 400,
  });
  s.tasks.find((t) => t.id === "VD01")!.proofImage = {
    url: "/api/assets/proof-VD01-test.png",
    name: "proof-VD01-test.png",
    uploadedAt: new Date().toISOString(),
  };
  update(s, manager, "VD01", {
    status: "done",
    publishedUrl: "https://www.tiktok.com/@saoviet/video/123",
  });
  assert.equal(s.tasks.find((t) => t.id === "VD01")!.progress, 100);
  for (const action of ["createUser", "updateUser", "settings"])
    assert.throws(() => mutate(s, manager, { action, payload: {} }), {
      status: 403,
    });
  assert.throws(() => update(s, employee, "VD01", { progress: 30 }), {
    status: 403,
  });
  assert.throws(
    () =>
      mutate(s, employee, {
        action: "createTask",
        payload: { title: "Forbidden" },
      }),
    { status: 403 },
  );
});
test("optimistic version prevents overwriting newer changes", () => {
  const s = state();
  update(s, owner, "VD01", { progress: 95 }, 1);
  assert.throws(() => update(s, owner, "VD01", { progress: 80 }, 1), {
    status: 409,
  });
  assert.equal(s.tasks.find((t) => t.id === "VD01")!.progress, 95);
});
test("comments preserve an open edit version; archived work cannot be changed by employees", () => {
  const s = state();
  const thisWeek = weekStart(vietnamDate());
  update(s, owner, "VD01", { assignee: employee.id, dueDate: addDays(thisWeek, 1) });
  s.tasks.find((t) => t.id === "VD01")!.proofImage = {
    url: "/api/assets/proof-VD01-c.png",
    name: "proof-VD01-c.png",
    uploadedAt: new Date().toISOString(),
  };
  const version = s.tasks.find((t) => t.id === "VD01")!.version;
  mutate(s, employee, {
    action: "comment",
    payload: { id: "VD01", body: "Ready for review" },
  });
  update(
    s,
    employee,
    "VD01",
    { status: "review", publishedUrl: "https://www.facebook.com/saoviet/posts/99" },
    version,
  );
  assert.equal(s.tasks.find((t) => t.id === "VD01")!.comments.length, 1);
  update(s, owner, "VD01", { archived: true });
  assert.throws(() => update(s, employee, "VD01", { progress: 20 }), {
    status: 403,
  });
});
test("social slots reject duplicate platforms, unapproved publishing and mismatched URLs", () => {
  const s = state();
  ensureRecurring(s, new Date("2026-11-25T03:00Z"));
  const [a, b] = s.tasks.filter((t) => t.week === "2026-11-23");
  assert.throws(() => update(s, owner, a.id, { platform: b.platform }));
  assert.throws(() => update(s, owner, a.id, { archived: true }));
  assert.throws(() =>
    update(s, owner, a.id, {
      publication: "published",
      publishedUrl: "https://hashnode.com/post/test",
    }),
  );
  update(s, owner, a.id, { publication: "approved" });
  assert.throws(() => update(s, owner, a.id, { publication: "published" }));
  assert.throws(() =>
    update(s, owner, a.id, {
      publication: "published",
      publishedUrl: "https://evilhashnode.com/test",
    }),
  );
  update(s, owner, a.id, {
    publication: "published",
    publishedUrl: "https://hashnode.com/post/test",
  });
  assert.ok(a.publishedAt);
});
test("locking an account revokes its existing session; owner cannot be demoted", () => {
  const s = state();
  s.sessions.push({
    hash: tokenHash("session-test"),
    userId: employee.id,
    expires: Date.now() + 10000,
  });
  assert.equal(currentUser(s, "session-test").id, employee.id);
  mutate(s, owner, {
    action: "updateUser",
    payload: { id: employee.id, active: false },
  });
  assert.throws(() => currentUser(s, "session-test"), { status: 401 });
  assert.throws(() =>
    mutate(s, owner, {
      action: "updateUser",
      payload: { id: owner.id, role: "employee" },
    }),
  );
  assert.throws(() => currentUser(s, undefined), { status: 401 });
});
