import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const routes = [
  "src/app/api/cron/releve-mails/route.ts",
  "src/app/api/cron/alleger-videos/route.ts",
];

function chargerRoute(path, secret) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const appels = { db: 0, mails: 0, videos: 0 };
  runInNewContext(compiled, {
    exports,
    process: { env: { CRON_SECRET: secret } },
    require(name) {
      if (name === "next/server") {
        return { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } };
      }
      if (name === "@/lib/supabase/admin") {
        return { createAdminClient: () => { appels.db++; throw new Error("DB sollicitée avant autorisation"); } };
      }
      if (name === "@/lib/email/releve") {
        return { releverReponsesMail: async () => { appels.mails++; return []; } };
      }
      if (name === "@/lib/casting/allegement") {
        return {
          prochainesAAlleger: async () => { appels.videos++; return []; },
          alleger: async () => { appels.videos++; return { statut: "ok" }; },
        };
      }
      throw new Error(`Import inattendu : ${name}`);
    },
  });
  return { get: exports.GET, appels };
}

function requete(token) {
  return { headers: { get: () => token } };
}

test("les deux CRON refusent toute requête si CRON_SECRET manque", async () => {
  for (const path of routes) {
    const route = chargerRoute(path, undefined);
    const res = await route.get(requete(null));
    assert.equal(res.status, 401, path);
    assert.deepEqual(route.appels, { db: 0, mails: 0, videos: 0 });
  }
});

test("les deux CRON refusent un jeton incorrect", async () => {
  for (const path of routes) {
    const route = chargerRoute(path, "un-secret-de-test");
    const res = await route.get(requete("Bearer mauvais"));
    assert.equal(res.status, 401, path);
    assert.deepEqual(route.appels, { db: 0, mails: 0, videos: 0 });
  }
});

test("les deux CRON acceptent le jeton correct", async () => {
  for (const path of routes) {
    const route = chargerRoute(path, "un-secret-de-test");
    const res = await route.get(requete("Bearer un-secret-de-test"));
    assert.equal(res.status, 200, path);
    assert.equal(route.appels.mails + route.appels.videos, 1, path);
  }
});
