import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProfileSearchFilter } from "../src/lib/figurants/search-filter.ts";

test("searches across first name, last name, email and phone", () => {
  assert.equal(buildProfileSearchFilter("Marianne"),
    "nom.ilike.*Marianne*,prenom.ilike.*Marianne*,email.ilike.*Marianne*,telephone.ilike.*Marianne*");
});

test("full-name query requires all terms in any name/contact column", () => {
  const filter = buildProfileSearchFilter("  Éléa   Gravagna  ");
  assert.ok(filter.startsWith("and(or("));
  assert.match(filter, /nom\.ilike\.\*Éléa\*/);
  assert.match(filter, /prenom\.ilike\.\*Gravagna\*/);
  assert.match(filter, /\),or\(/);
});

test("forged PostgREST control symbols cannot create extra predicates", () => {
  const filter = buildProfileSearchFilter("(admin,role.eq.owner)%\\foo*");
  assert.ok(filter);
  assert.doesNotMatch(filter, /(?:^|,)role\.eq\.owner/);
  assert.doesNotMatch(filter, /,role\./);
  assert.doesNotMatch(filter, /%|\\/);
});

test("ignores empty/malformed input and limits term count", () => {
  assert.equal(buildProfileSearchFilter(" %,_() "), null);
  assert.equal(buildProfileSearchFilter(null), null);
  const filter = buildProfileSearchFilter("un deux trois quatre cinq six");
  assert.ok(filter.includes("quatre"));
  assert.equal(filter.includes("cinq"), false);
});

test("query builder relies on safe filter instead of raw user input", () => {
  const query = readFileSync(new URL("../src/lib/figurants/query.ts", import.meta.url), "utf8");
  assert.match(query, /buildProfileSearchFilter\(params\.q\)/);
  assert.doesNotMatch(query, /ilike\.\%\$\{params\.q\}/);
});
