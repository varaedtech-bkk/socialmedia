import test from "node:test";
import assert from "node:assert/strict";
import { jsonRequest, login } from "./helpers/http.mjs";

test("health endpoint returns healthy", async () => {
  const { res, body } = await jsonRequest("/api/health");
  assert.equal(res.status, 200);
  assert.equal(body.status, "healthy");
});

test("readiness endpoint returns ready", async () => {
  const { res, body } = await jsonRequest("/api/health/ready");
  assert.equal(res.status, 200);
  assert.equal(body.status, "ready");
});

test("owner login works and session endpoint responds", async () => {
  const auth = await login("demo_owner", "DemoOwner@123");
  assert.equal(auth.status, 200);
  assert.ok(auth.cookie.length > 0, "missing auth cookie");

  const { res, body } = await jsonRequest("/api/user", {
    headers: { Cookie: auth.cookie },
  });
  assert.equal(res.status, 200);
  assert.equal(body.username, "demo_owner");
});

test("invalid whatsapp attach token returns 400 (authenticated)", async () => {
  const auth = await login("demo_owner", "DemoOwner@123");
  assert.equal(auth.status, 200);

  const { res, body } = await jsonRequest("/api/whatsapp/attach", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: auth.cookie,
    },
    body: JSON.stringify({ token: "definitely-not-a-valid-token" }),
  });

  assert.equal(res.status, 400);
  assert.match(String(body?.error || ""), /invalid|expired/i);
});

