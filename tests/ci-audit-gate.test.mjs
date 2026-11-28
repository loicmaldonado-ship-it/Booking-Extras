import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const content = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
test("CI checks high-severity production dependencies without force upgrades", () => {
  assert.match(content, /npm audit --omit=dev --audit-level=high/);
  assert.doesNotMatch(content, /audit fix --force/);
  assert.match(content, /npm test/);
  assert.match(content, /npm run build/);
  assert.match(content, /\s+- elea\s+/);
});
