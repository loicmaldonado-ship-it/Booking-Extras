import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { validateCandidatureBulkIds } from "../src/lib/candidatures/bulk-guard.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/lib/candidatures/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const id = (i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`;

function mock({ candidates, annonces, cError = null, aError = null, denied = null, writeError = null, updateCount = null, onglet = null, avantIncomplete = false, outError = false } = {}) {
  const selection = [id(1), id(2)];
  const rows = candidates ?? [
    { id: id(1), annonce_id: id(11) }, { id: id(2), annonce_id: id(12) },
  ];
  const projects = annonces ?? [
    { id: id(11), projet_id: id(21) }, { id: id(12), projet_id: id(22) },
  ];
  const writes = [], reads = [], revalidates = [];
  let checked = [];
  const db = {
    from(table) {
      const q = {
        table, operation: "read", filters: [],
        select() { return this; },
        eq(field, value) { this.filters.push({ field, value }); return this; },
        in(field, values) { this.filters.push({ field, values }); return this; },
        update(values) { this.operation = "update"; writes.push({ table, values }); return this; },
        delete() { this.operation = "delete"; writes.push({ table, method: "delete" }); return this; },
        maybeSingle() { return Promise.resolve(this.answer()); },
        answer() {
          reads.push({ table, op: this.operation });
          if (this.operation !== "read") {
            if (writeError) return { data: null, error: writeError };
            const result = this.operation === "delete" ? [{ id: id(50) }] : rows;
            return { data: updateCount === null ? result : result.slice(0, updateCount), error: null };
          }
          if (table === "candidatures") return { data: rows, error: cError };
          if (table === "annonces") {
            const row = this.filters.find(x => x.field === "id" && "value" in x);
            if (row) return { data: projects[0] || null, error: aError };
            return { data: projects, error: aError };
          }
          if (table === "candidature_onglets") return { data: onglet, error: null };
          return { data: null, error: null };
        },
        then(yes, no) { return Promise.resolve(this.answer()).then(yes, no); },
      };
      return q;
    },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => db };
      if (name === "next/cache") return { revalidatePath: p => revalidates.push(p) };
      if (name === "@/lib/auth/session") return { checkProjetAccess: async (project) => { checked.push(project); return denied?.(project) ?? null; } };
      if (name === "./bulk-guard") return { validateCandidatureBulkIds };
      if (name === "./out") return { lireOngletsAvant: async (ids) => avantIncomplete ? [] : ids.map(id => ({id})), appliquerMessagesOut: async () => { if (outError) throw new Error("offline"); } };
      return {};
    },
  });
  return { actions: exports, writes, reads, revalidates, get checked() { return checked; }, selection };
}

test("bulk selection validates UUIDs, duplicates, malformed inputs and limit", () => {
  assert.equal(validateCandidatureBulkIds([]).ok, true);
  for (const value of [null, "oops", ["invalid"], [id(1), id(1).toUpperCase()], Array(151).fill(id(1))]) {
    assert.equal(validateCandidatureBulkIds(value).ok, false);
  }
});

test("bulk rejects absent rows and database errors before any mutation", async () => {
  for (const opts of [
    { candidates: [{ id: id(1), annonce_id: id(11) }] },
    { cError: { message: "offline" } },
    { annonces: [{ id: id(11), projet_id: id(21) }] },
    { aError: { message: "offline" } },
  ]) {
    const env = mock(opts);
    const response = await env.actions.setCandidaturesOngletBulk(env.selection, null);
    assert.equal(typeof response.error, "string");
    assert.equal(env.writes.length, 0);
  }
});

test("bulk checks every distinct project, rejects another team's candidature", async () => {
  const env = mock({ denied: (project) => project === id(22) ? "Accès interdit" : null });
  const result = await env.actions.setCandidaturesOngletBulk(env.selection, null);
  assert.match(result.error, /interdit/);
  assert.equal(env.checked.length, 2);
  assert.equal(env.writes.length, 0);
});

test("bulk persists valid selection, but never reports success on write failure", async () => {
  const valid = mock();
  const ok = await valid.actions.setCandidaturesOngletBulk(valid.selection, null);
  assert.equal(ok.success, true);
  assert.equal(valid.writes.length, 1);
  assert.deepEqual(valid.revalidates, ["/candidatures"]);
  for (const opts of [{ writeError: { message: "failed" } }, { updateCount: 1 }]) {
    const env = mock(opts);
    const result = await env.actions.setCandidaturesOngletBulk(env.selection, null);
    assert.equal(typeof result.error, "string");
    assert.equal(env.revalidates.length, 0);
  }
});

test("cannot delete fixed/shared tabs or another team's tab", async () => {
  for (const onglet of [{ fixe: true, annonce_id: id(11) }, { fixe: false, annonce_id: null }, null]) {
    const env = mock({ onglet });
    const result = await env.actions.deleteCandidatureOnglet(id(50));
    assert.ok(result.error);
    assert.equal(env.writes.length, 0);
  }
  const env = mock({ onglet: { fixe: false, annonce_id: id(11) }, denied: () => "Accès refusé" });
  const response = await env.actions.deleteCandidatureOnglet(id(50));
  assert.match(response.error, /refusé/);
  assert.equal(env.writes.length, 0);
});

test("owner/member can delete own tab and receives a result", async () => {
  const env = mock({ onglet: { fixe: false, annonce_id: id(11) } });
  const response = await env.actions.deleteCandidatureOnglet(id(50));
  assert.equal(response.success, true);
  assert.equal(env.writes.length, 1);
  assert.deepEqual(env.revalidates, ["/candidatures"]);
});

test("bulk UI preserves selected candidates and alerts on a failed operation", () => {
  const view = readFileSync(new URL("../src/components/candidatures/candidatures-table.tsx", import.meta.url), "utf8");
  assert.match(view, /if \(res && "error" in res && res\.error\)\s*\{\s*setErreur\(res\.error\);\s*return;/);
  assert.match(view, /<p role="alert" className="text-sm text-danger">\{erreur\}<\/p>/);
});

test("bulk tab change aborts when previous state cannot be read", async () => {
  const env = mock({ avantIncomplete: true });
  const result = await env.actions.setCandidaturesOngletBulk(env.selection, null);
  assert.ok(result.error);
  assert.equal(env.writes.length, 0);
});

test("message failure reports that the tab change was already saved", async () => {
  const env = mock({ outError: true });
  const result = await env.actions.setCandidaturesOngletBulk(env.selection, null);
  assert.match(result.error, /rang.*mais/i);
  assert.equal(env.writes.length, 1);
  assert.deepEqual(env.revalidates, ["/candidatures"]);
});
