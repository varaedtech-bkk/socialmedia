import test from "node:test";
import assert from "node:assert/strict";
import { BASE_URL } from "./helpers/http.mjs";

test("auth page renders application shell", async () => {
  const res = await fetch(`${BASE_URL}/auth`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /<div id="root"><\/div>/i);
});

test("root page renders app shell", async () => {
  const res = await fetch(`${BASE_URL}/`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /<div id="root"><\/div>/i);
  // Support both dev (src/main.tsx) and production (hashed /assets/index-*.js) bundles.
  assert.match(html, /<script type="module".*(\/src\/main\.tsx|\/assets\/index-).*><\/script>/i);
});

