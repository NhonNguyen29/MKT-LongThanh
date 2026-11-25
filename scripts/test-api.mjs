import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Run smoke checks only against local TEST",
);
assert.equal((await fetch(base + "/api/state")).status, 401);
assert.equal(
  (await fetch(base + "/api/assets/01-ai-cong-viec.png")).status,
  401,
);
assert.equal(
  (
    await fetch(base + "/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify({ testRole: "owner" }),
    })
  ).status,
  403,
);
for (const role of ["owner", "manager", "employee"]) {
  const login = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ testRole: role }),
  });
  assert.equal(login.status, 200);
  const raw = login.headers.get("set-cookie");
  assert.match(raw, /httponly/i);
  assert.match(raw, /samesite=strict/i);
  const cookie = raw.split(";")[0];
  const first = await fetch(base + "/api/state", {
    headers: { Cookie: cookie },
  });
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.user.role, role);
  assert.ok(!JSON.stringify(data).includes("passwordHash"));
  if (role === "employee") {
    assert.ok(data.tasks.every((t) => t.assignee === data.user.id));
    const denied = await fetch(base + "/api/state", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "createTask",
        payload: { title: "Must not be created" },
      }),
    });
    assert.equal(denied.status, 403);
  }
  const second = await (
    await fetch(base + "/api/state", { headers: { Cookie: cookie } })
  ).json();
  assert.deepEqual(second.tasks, data.tasks);
  assert.equal(
    (
      await fetch(base + "/api/auth", {
        method: "DELETE",
        headers: { Cookie: cookie, Origin: base },
      })
    ).status,
    200,
  );
  assert.equal(
    (await fetch(base + "/api/state", { headers: { Cookie: cookie } })).status,
    401,
  );
}
console.log(
  "PASS: login 3 roles, auth protection, CSRF, cookie flags, role filtering, persisted reload and session revocation. No business task changed.",
);
