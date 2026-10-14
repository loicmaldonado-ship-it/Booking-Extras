import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("CI runs automatically for elea pushes without enabling push triggers on main", () => {
  assert.match(workflow, /^on:\s*\n  push:\s*\n    branches:\s*\n      - elea\s*$/m);
  assert.doesNotMatch(workflow, /^      - main\s*$/m);
  assert.match(workflow, /^  pull_request:$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
});

test("CI checks tests, lint, TypeScript and production build", () => {
  for (const command of ["npm ci", "npm test", "npm run lint", "npm run typecheck", "npm run build"]) {
    assert.ok(workflow.includes(`- run: ${command}`), `Commande absente : ${command}`);
  }
  assert.match(workflow, /^    permissions:\s*\n      contents: read$/m);
});
