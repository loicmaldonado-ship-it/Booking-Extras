import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/lib/partage/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Test des véritables Server Actions avec Supabase et authentification simulés,
// sans connexion à une base ni secrets de production.
function harness({ error = null, deny = null, data = null } = {}) {
  const writes = [];
  const revalidations = [];
  const query = {
    eq() { return this; },
    is() { return this; },
    select() { return this; },
    update(value) { writes.push({ action: "update", value }); return this; },
    delete() { writes.push({ action: "delete" }); return this; },
    maybeSingle() { return Promise.resolve({ data, error }); },
    then(resolve, reject) { return Promise.resolve({ data, error }).then(resolve, reject); },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === "crypto") return require("node:crypto");
      if (name === "next/cache") return { revalidatePath: (path) => revalidations.push(path) };
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => ({ from: () => query }) };
      if (name === "@/lib/auth/session") return { checkProjetAccess: async () => deny };
      if (name === "@/lib/partage/data") return { COLONNES_OPTIONS_REEL: { age: "reel_afficher_age" } };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return { actions: exports, writes, revalidations };
}

const project = "11111111-1111-4111-8111-111111111111";
const actions = [
  ["updatePartageTitre", [project, "casting", "Nouveau titre"]],
  ["updateCastingDocVisible", [project, "distribution", true]],
  ["updateFichesRolesMasquerContact", [project, true]],
  ["updateReelOption", [project, "age", false]],
  ["revokePartageLien", [project, "casting"]],
  ["revokeJourneePartageLien", [project, "2026-10-20"]],
];

test("une erreur Supabase bloque chaque mutation et n'annonce aucun rafraîchissement réussi", async () => {
  for (const [method, args] of actions) {
    const app = harness({ error: { message: "DB unavailable" } });
    await assert.rejects(app.actions[method](...args), /Impossible de/);
    assert.equal(app.writes.length, 1, `${method} a bien tenté une mutation`);
    assert.equal(app.revalidations.length, 0, `${method} ne doit pas annoncer un succès`);
  }
});

test("chaque mutation refuse l'absence de droits avant l'accès Supabase", async () => {
  for (const [method, args] of actions) {
    const app = harness({ deny: "Accès refusé." });
    await assert.rejects(app.actions[method](...args), /Accès refusé/);
    assert.equal(app.writes.length, 0, `${method} ne doit pas modifier de données`);
  }
});

test("les mutations autorisées réussies rafraîchissent le contenu", async () => {
  for (const [method, args] of actions) {
    const app = harness();
    await app.actions[method](...args);
    assert.equal(app.writes.length, 1);
    assert.ok(app.revalidations.length > 0);
  }
});

test("les lectures de tokens/titres distinguent erreur SQL et absence de ligne", async () => {
  const readers = [
    ["getPartageToken", [project, "casting"]],
    ["getPartageTitre", [project, "casting"]],
    ["getJourneePartageLien", [project, "2026-10-20"]],
  ];
  for (const [method, args] of readers) {
    await assert.rejects(harness({ error: { message: "DB unavailable" } }).actions[method](...args), /Impossible de/);
    assert.equal(await harness().actions[method](...args), null);
  }
});

test("les paramètres falsifiés ne modifient pas la visibilité casting", async () => {
  for (const [method, args] of [
    ["updateCastingDocVisible", [project, "inconnu", true]],
    ["updateCastingDocVisible", [project, "distribution", "false"]],
    ["updateFichesRolesMasquerContact", [project, "true"]],
    ["updateReelOption", [project, "age", "false"]],
    ["updateReelOption", [project, "__proto__", true]],
  ]) {
    const app = harness();
    await assert.rejects(app.actions[method](...args), /invalide/);
    assert.equal(app.writes.length, 0);
  }
});

const partageDataSource = readFileSync(new URL("../src/lib/partage/data.ts", import.meta.url), "utf8");
const partageDataCompiled = ts.transpileModule(partageDataSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function dataHarness({ data = null, error = null } = {}) {
  const query = {
    select() { return this; },
    eq() { return this; },
    is() { return this; },
    maybeSingle() { return Promise.resolve({ data, error }); },
  };
  const exports = {};
  runInNewContext(partageDataCompiled, {
    exports,
    require(name) {
      if (name === "next/headers") return { headers: async () => ({ get: () => "test.local" }) };
      if (name === "@/lib/supabase/admin") return { createAdminClient: () => ({ from: () => query }) };
      throw new Error(`Unexpected module: ${name}`);
    },
  });
  return exports;
}

test("le lien réal échoue fermé si sa catégorie ou ses options ne sont pas lisibles", async () => {
  const broken = dataHarness({ error: { message: "DB unavailable" } });
  await assert.rejects(broken.getCategorieLienCasting("token"), /indisponible/);
  await assert.rejects(broken.getReelOptions({ token: "token" }), /Impossible de/);

  const missing = dataHarness();
  await assert.rejects(missing.getCategorieLienCasting("token"), /indisponible/);
  await assert.rejects(missing.getReelOptions({ token: "token" }), /indisponible/);
  assert.equal((await missing.getReelOptions({ projetId: project })).age, true);
});
