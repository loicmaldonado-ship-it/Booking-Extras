import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../scripts/smoke-readonly-local.mjs", import.meta.url), "utf8");
test("le smoke automatisé refuse les destinations distantes", () => {
  assert.match(source, /\["127\.0\.0\.1", "localhost", "\[::1\]"\]/);
  assert.match(source, /url\.protocol !== "http:"/);
  assert.match(source, /url\.username \|\| url\.password/);
});
test("le smoke n'effectue que des GET, sans transmettre d'identifiants", () => {
  assert.match(source, /method: "GET"/);
  assert.match(source, /redirect: "manual"/);
  assert.match(source, /credentials: "omit"/);
  assert.doesNotMatch(source, /method: "(?:POST|PUT|PATCH|DELETE)"/);
  assert.doesNotMatch(source, /\.env\.local|SERVICE_ROLE_KEY|password:/);
});
