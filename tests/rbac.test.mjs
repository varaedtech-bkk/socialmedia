import test from "node:test";
import assert from "node:assert/strict";
import { jsonRequest, login } from "./helpers/http.mjs";

test("owner can access company members admin API", async () => {
  const auth = await login("demo_owner", "DemoOwner@123");
  assert.equal(auth.status, 200);

  const { res } = await jsonRequest("/api/admin/company/members", {
    headers: { Cookie: auth.cookie },
  });
  assert.equal(res.status, 200);
});

test("moderator is forbidden from company members admin API", async () => {
  const auth = await login("demo_moderator", "DemoModerator@123");
  assert.equal(auth.status, 200);

  const { res, body } = await jsonRequest("/api/admin/company/members", {
    headers: { Cookie: auth.cookie },
  });
  assert.equal(res.status, 403);
  assert.match(String(body?.error || body?.message || ""), /admin|forbidden/i);
});

test("super admin can access platform admin config", async () => {
  const auth = await login("demo_superadmin", "DemoSuperAdmin@123");
  assert.equal(auth.status, 200);

  const { res } = await jsonRequest("/api/admin/config", {
    headers: { Cookie: auth.cookie },
  });
  assert.equal(res.status, 200);
});

