import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { STATUTS, COVOITURAGE_ROLES } from "../src/lib/bookings/types.ts";
import { CACHETS } from "../src/lib/candidatures/types.ts";
import { validateBookingDropSelection, isValidBookingDate } from "../src/lib/bookings/drop-guard.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compile = file => ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const src = compile("src/lib/bookings/actions.ts");
const bulkExports = {};
runInNewContext(compile("src/lib/bookings/bulk-guard.ts"), {
  exports: bulkExports,
  require(name) {
    if (name === "./types") return { STATUTS, COVOITURAGE_ROLES };
    if (name === "@/lib/candidatures/types") return { CACHETS };
    throw new Error(name);
  },
});
const { validateBookingBulkIds, validateBookingBulkChanges } = bulkExports;
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;

function harness({ rows, readError = null, deny = null, updateError = null, updatedRows, day = { projet_id: id(30), date: "2026-10-22" }, count = 0, countError = null } = {}) {
  const targeted = rows ?? [{ id: id(1), projet_id: id(30) }, { id: id(2), projet_id: id(30) }];
  const changed = updatedRows === undefined ? targeted : updatedRows;
  const writes = [], revalidated = [], checked = [];
  const db = {
    from(table) {
      const q = {
        op: "read",
        select() { return this; }, eq() { return this; }, in() { return this; },
        delete() { this.op = "delete"; writes.push({ table, op: "delete" }); return this; },
        update(payload) { this.op = "update"; writes.push({ table, op: "update", payload }); return this; },
        maybeSingle() { return Promise.resolve(this.answer()); },
        answer() {
          if (this.op === "update" || this.op === "delete") {
            return { data: changed, error: updateError };
          }
          if (table === "bookings") return { data: targeted, error: readError, count, countError };
          if (table === "journees") return { data: day, error: readError };
          return { data: null, error: null };
        },
        then(resolve, reject) {
          const response = this.answer();
          // count()/head query returns the count and an error, never target rows
          if (table === "bookings" && this.op === "read" && countError) {
            response.error = countError;
          }
          return Promise.resolve(response).then(resolve, reject);
        },
      };
      return q;
    },
  };
  const exports = {};
  runInNewContext(src, {
    exports,
    require(name) {
      if (name === "@/lib/figurants/access") return { checkVisibleFigurants: async () => null };
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => db };
      if (name === "@/lib/auth/session") return { checkProjetAccess: async p => { checked.push(p); return deny; } };
      if (name === "./bulk-guard") return bulkExports;
      if (name === "./drop-guard") return { validateBookingDropSelection, isValidBookingDate };
      if (name === "next/cache") return { revalidatePath: path => revalidated.push(path) };
      return {};
    },
  });
  return { actions: exports, writes, revalidated, checked };
}

test("bulk edits reject invalid IDs, duplicate IDs, unknown fields and forged status", () => {
  assert.equal(validateBookingBulkIds([id(1)]).ok, true);
  for (const x of [["not-a-uuid"], [id(1), id(1)], Array(151).fill(id(1)), "not-an-array"]) {
    assert.equal(validateBookingBulkIds(x).ok, false);
  }
  for (const changes of [{}, { projet_id: id(100) }, { statut: "SUPER_OWNER" },
    { reponse_recue: "true" }, { covoiturage_places_disponibles: -1 },
    { heure_convocation: "77:61" }]) {
    assert.equal(validateBookingBulkChanges(changes).ok, false);
  }
  assert.equal(validateBookingBulkChanges({ statut: "confirmé", fonction: "Figuration", reponse_recue: true }).ok, true);
});

test("service_role bulk edit aborts on incomplete selection, read failure or denied project", async () => {
  for (const opts of [
    { rows: [{ id: id(1), projet_id: id(30) }] },
    { readError: { message: "server down" } },
    { deny: "Projet interdit" },
  ]) {
    const e = harness(opts);
    const res = await e.actions.bulkUpdateBookings([id(1), id(2)], { statut: "confirmé" });
    assert.ok(res.error);
    assert.equal(e.writes.length, 0);
  }
});

test("bulk update reports write errors and partial update counts", async () => {
  for (const opts of [{ updateError: { message: "DB down" } }, { updatedRows: [{ id: id(1) }] }]) {
    const e = harness(opts);
    const res = await e.actions.bulkUpdateBookings([id(1), id(2)], { statut: "confirmé" });
    assert.equal(typeof res.error, "string");
    assert.equal(e.revalidated.length, 0);
  }
});

test("valid bulk edit updates only allowlisted columns, then refreshes booking pages", async () => {
  const e = harness();
  const res = await e.actions.bulkUpdateBookings([id(1), id(2)], { statut: "confirmé", reponse_recue: true });
  assert.deepEqual(Object.keys(res), []);
  assert.equal(e.writes.length, 1);
  assert.deepEqual(Object.keys(e.writes[0].payload).sort(), ["reponse_recue", "reponse_recue_le", "statut"]);
  assert.deepEqual(e.revalidated, ["/bookings", "/bookings/documents"]);
});

test("never delete a journée if booking count is unavailable or positive", async () => {
  const s = readFileSync(new URL("../src/lib/bookings/actions.ts", import.meta.url), "utf8");
  const part = s.slice(s.indexOf("export async function deleteJournee("), s.indexOf("export async function updateTotalJournee("));
  assert.match(part, /if \(countError \|\| count === null\)/);
  assert.match(part, /if \(count > 0\)/);
});

test("booking bulk UI preserves selection and displays server errors", () => {
  const view = readFileSync(new URL("../src/components/bookings/bookings-table.tsx", import.meta.url), "utf8");
  assert.match(view, /if \(result\.error\)\s*\{\s*setBulkError\(result\.error\);\s*return;/);
  assert.match(view, /bulkError && <p role="alert"/);
});
