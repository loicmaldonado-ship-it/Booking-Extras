import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { validateBookingDropSelection, isValidBookingDate } from "../src/lib/bookings/drop-guard.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(readFileSync(new URL("../src/lib/bookings/actions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const day = "2026-10-21";

function mock({ denied = null, personDenied = null, cRows, cError = null, existing = [], existingError = null, upsertError = null, insertError = null, confirmError = null } = {}) {
  const writes = [], reads = [], validated = [], revalidates = [];
  const rows = cRows ?? [{ id: id(10), figurant_id: id(1), annonces: { projet_id: id(100) } }];
  const db = {
    from(table) {
      const q = {
        operation: "read", fields: [],
        select() { return this; },
        eq(...x) { this.fields.push(x); return this; },
        in(...x) { this.fields.push(x); return this; },
        returns() { return this; },
        update(values) { this.operation = "update"; writes.push({ table, op: "update", values }); return this; },
        upsert(values) { this.operation = "upsert"; writes.push({ table, op: "upsert", values }); return this; },
        insert(values) { this.operation = "insert"; writes.push({ table, op: "insert", values }); return this; },
        maybeSingle() { return Promise.resolve(this.answer()); },
        answer() {
          reads.push(table);
          if (this.operation === "upsert") return { data: null, error: upsertError };
          if (this.operation === "insert") return { data: null, error: insertError };
          if (this.operation === "update") return { data: null, error: confirmError };
          if (table === "candidatures") return { data: rows, error: cError };
          if (table === "bookings") {
            const single = this.fields.some(x => x[0] === "date" && typeof x[1] === "string");
            return { data: single ? (existing[0] || null) : existing, error: existingError };
          }
          return { data: null, error: null };
        },
        then(resolve, reject) { return Promise.resolve(this.answer()).then(resolve, reject); },
      };
      return q;
    },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === "@/lib/figurants/access") return { checkVisibleFigurants: async () => personDenied };
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => db };
      if (name === "@/lib/auth/session") return { checkProjetAccess: async p => { validated.push(p); return denied; } };
      if (name === "./drop-guard") return { validateBookingDropSelection };
      if (name === "next/cache") return { revalidatePath: p => revalidates.push(p) };
      return {};
    },
  });
  return { actions: exports, writes, reads, validated, revalidates };
}

const bulk = (e, map = { [id(1)]: id(10) }) => e.actions.createBookingsFromDropBulk([id(1)], id(100), [day], map, "Silhouette", "Silhouette");

test("booking dates reject calendar overflow, forged ids, huge or duplicate selections", () => {
  assert.equal(isValidBookingDate("2026-02-29"), false);
  assert.equal(isValidBookingDate("2028-02-29"), true);
  assert.equal(isValidBookingDate("2026-99-01"), false);
  for (const payload of [
    [[id(1)], ["2026-02-29"]],
    [[id(1), id(1)], [day]],
    [[id(1)], [day, day]],
    [Array(1501).fill(id(1)), [day]],
    [["not-a-uuid"], [day]],
  ]) assert.equal(validateBookingDropSelection(...payload).ok, false);
  assert.equal(validateBookingDropSelection([id(1)], [day], { [id(2)]: id(10) }).ok, false);
  assert.equal(validateBookingDropSelection([id(1)], [day], { [id(1)]: "oops" }).ok, false);
  assert.equal(validateBookingDropSelection([id(1)], [day], { [id(1)]: id(10) }).ok, true);
});

test("bulk transfer denies forged candidate ownership or project before all writes", async () => {
  for (const cRows of [[], [{ id: id(10), figurant_id: id(2), annonces: { projet_id: id(100) } }],
    [{ id: id(10), figurant_id: id(1), annonces: { projet_id: id(200) } }]]) {
    const e = mock({ cRows });
    const res = await bulk(e);
    assert.ok(res.error);
    assert.equal(e.writes.length, 0);
  }
  const denied = mock({ denied: "Projet interdit" });
  assert.match((await bulk(denied)).error, /interdit/);
  assert.equal(denied.writes.length, 0);
});

test("bulk transfer fails closed on lookup, day upsert and booking insert errors", async () => {
  for (const opts of [
    { cError: { message: "lookup" } }, { existingError: { message: "lookup" } },
    { upsertError: { message: "upsert" } }, { insertError: { message: "insert" } },
  ]) {
    const e = mock(opts);
    const res = await bulk(e);
    assert.equal(typeof res.error, "string");
    assert.equal(res.ok, 0);
    assert.equal(e.writes.some(w => w.table === "figurants"), false);
  }
});

test("bulk transfer reports duplicate/no-op accurately and successful writes", async () => {
  const e = mock();
  const result = await bulk(e);
  assert.equal(result.ok, 1);
  assert.equal(result.deja, 0);
  assert.deepEqual(e.writes.map(w => w.table), ["journees", "bookings", "figurants"]);
  assert.ok(e.revalidates.includes("/bookings/planning"));
  const existing = mock({ existing: [{ figurant_id: id(1), date: day }] });
  const duplicate = await bulk(existing);
  assert.equal(duplicate.ok, 0);
  assert.equal(duplicate.deja, 1);
  assert.equal(existing.writes.some(w => w.table === "bookings"), false);
});

test("partial post-booking profile confirmation is not reported as full success", async () => {
  const e = mock({ confirmError: { message: "failed" } });
  const res = await bulk(e);
  assert.equal(res.ok, 1);
  assert.match(res.error, /confirmation/);
});

test("single drop prevents mismatched candidate and existing booking", async () => {
  const forged = mock({ cRows: [{ id: id(10), figurant_id: id(2), annonces: { projet_id: id(100) } }] });
  const result = await forged.actions.createBookingFromDrop(id(1), id(100), day, id(10));
  assert.ok(result.error);
  assert.equal(forged.writes.length, 0);
  const duplicate = mock({ existing: [{ id: id(20) }] });
  const err = await duplicate.actions.createBookingFromDrop(id(1), id(100), day);
  assert.match(err.error, /déjà booké/);
  assert.equal(duplicate.writes.length, 0);
});

test("UI preserves selection on transfer failure and exposes errors", () => {
  const src = readFileSync(new URL("../src/components/bookings/add-to-journee-bar.tsx", import.meta.url), "utf8");
  assert.match(src, /if \(!res\.error\)\s*\{\s*setDates\(\[\]\);\s*onDone\?\.\(\)/);
  assert.match(src, /role=\{result\.error \? "alert" : "status"\}/);
  assert.match(src, /if \(res\.ok > 0\) router\.refresh\(\)/);
});

test("cross-project staff booking omits old candidature reference while preserving selected candidates", () => {
  const bar = readFileSync(new URL("../src/components/bookings/add-to-journee-bar.tsx", import.meta.url), "utf8");
  const table = readFileSync(new URL("../src/components/candidatures/candidatures-table.tsx", import.meta.url), "utf8");
  assert.match(bar, /candidatureProjectByFigurant\[id\] === projetId/);
  assert.match(bar, /referenceIds,\s*fonction/);
  assert.match(table, /candidatureProjectByFigurant=\{Object.fromEntries/);
});

test("booking transfer refuses a hidden person before any administrative write",async()=>{
 const h=mock({personDenied:"Profil inaccessible"});const r=await bulk(h);assert.match(r.error,/inaccessible/);assert.equal(h.writes.length,0);
 const one=await h.actions.createBookingFromDrop(id(1),id(100),day,undefined,"Figuration","Figurant");assert.match(one.error,/inaccessible/);assert.equal(h.writes.length,0);
});
