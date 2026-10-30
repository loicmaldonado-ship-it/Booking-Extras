// BUG-13 (30/10/2026) : une écriture refusée par la base ne doit plus donner un faux succès.
// Un trigger TEMPORAIRE (base locale) fait échouer les écritures sur les seules lignes de ce test ; chaque action est
// appelée sur l'appli réelle et doit renvoyer/lever une erreur, sans avoir modifié les données. Trigger retiré à la fin.
// Usage : node tests/bug13-erreurs-mutations.mjs   (appli sur :3000, base locale fictive)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const act = (file, name) => { const e = Object.entries(manifest).find(([, v]) => v.filename === file && v.exportedName === name); assert.ok(e, `${file}#${name}`); const w = Object.keys(e[1].workers).find((k) => k.endsWith("/page") && !k.includes("[")) || Object.keys(e[1].workers)[0]; return { id: e[0], url: BASE + (w.replace(/^app/, "").replace(/\/page$/, "") || "/") }; };
const call = (page, file, name, args) => { const a = act(file, name); return page.evaluate(async ({ a, args }) => {
  const r = await fetch(a.url, { method: "POST", headers: { "Next-Action": a.id, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(args), redirect: "manual" });
  const t = await r.text(); return { status: r.status, result: (t.split("\n").find((l) => l.startsWith("1:")) || "").slice(2, 300) }; }, { a, args }); };
const echec = (r) => r.status >= 500 || /"error"/.test(r.result);

const tables = { projets: "id", projet_indemnites: "id", booking_indemnites: "booking_id", casting_roles: "id", notifications: "id", figurants: "id", casting_entries: "id" };
const bloquer = (...ids) => sql(`insert into public.bug13_cibles(cle) values ${ids.map((i) => `('${i}')`).join(",")} on conflict do nothing;`);

const M = "B13" + Date.now().toString(36);
const owner = sql("select id from profiles where email='cheffe.test@test-chat-charge.fr';");
const checks = [];
const check = (nom, ok, detail = "") => checks.push({ nom, ok: !!ok, detail: String(detail).slice(0, 110) });

let P, fig, bk, ind, role, notif, tmp;
const browser = await chromium.launch();
try {
  sql(`create table if not exists public.bug13_cibles(cle text primary key);
  create or replace function public.bug13_refuser() returns trigger language plpgsql as $$
  begin
    if exists (select 1 from public.bug13_cibles where cle = coalesce(to_jsonb(OLD), to_jsonb(NEW))->>TG_ARGV[0]) then
      raise exception 'BUG-13 test : écriture refusée volontairement';
    end if;
    return coalesce(NEW, OLD);
  end $$;
  ${Object.entries(tables).map(([t, c]) => `drop trigger if exists bug13_refuser on public.${t}; create trigger bug13_refuser before update or delete on public.${t} for each row execute function public.bug13_refuser('${c}');`).join("\n")}`);

  P = sql(`insert into projets(nom,owner_id) values('Projet ${M}','${owner}') returning id;`);
  fig = sql(`insert into figurants(prenom,nom,email,date_naissance) values('Lou','${M}','${M.toLowerCase()}@example.test','1990-01-01') returning id;`);
  const D = sql("select (current_date+30)::text;");
  sql(`insert into journees(projet_id,date) values('${P}','${D}');`);
  bk = sql(`insert into bookings(figurant_id,projet_id,date,statut,cachet) values('${fig}','${P}','${D}','confirmé','Figurant') returning id;`);
  ind = sql(`insert into projet_indemnites(projet_id,label,montant) values('${P}','Panier ${M}',12) returning id;`);
  sql(`insert into booking_indemnites(booking_id,projet_indemnite_id) values('${bk}','${ind}');`);
  role = sql(`insert into casting_roles(projet_id,nom) values('${P}','Role ${M}') returning id;`);
  notif = sql(`insert into notifications(type,titre,projet_id) values('partage','Notif ${M}','${P}') returning id;`);
  tmp = sql(`insert into figurants(prenom,nom,email,date_naissance,temporaire,temporaire_projet_id) values('Tmp','${M}T','${M.toLowerCase()}t@example.test','1990-01-01',true,'${P}') returning id;`);

  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", "cheffe.test@test-chat-charge.fr"); await page.fill("input[type=password]", "booking-test");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.locator("form button[type=submit]").first().click()]);
  await page.goto(BASE + "/projets");

  bloquer(ind, bk, role, notif, P, tmp);
  let r = await call(page, "src/lib/indemnites/actions.ts", "deleteProjetIndemnite", [ind]);
  check("Suppression d'indemnité refusée → erreur, indemnité conservée", echec(r) && sql(`select count(*) from projet_indemnites where id='${ind}';`) === "1", r.result);
  const role2 = sql(`insert into casting_roles(projet_id,nom) values('${P}','Role2 ${M}') returning id;`);
  const entree = sql(`insert into casting_entries(projet_id,role_id,figurant_id) values('${P}','${role2}','${fig}') returning id;`);
  bloquer(entree);
  r = await call(page, "src/lib/casting/actions.ts", "deleteCastingEntry", [entree]);
  check("Retrait d'un profil du casting refusé → erreur, profil conservé", echec(r) && sql(`select count(*) from casting_entries where id='${entree}';`) === "1", r.status);
  const autreP = sql(`insert into projets(nom,owner_id) values('Projet ${M} bis','${owner}') returning id;`);
  const indAutre = sql(`insert into projet_indemnites(projet_id,label,montant) values('${autreP}','Autre ${M}',5) returning id;`);
  r = await call(page, "src/lib/indemnites/actions.ts", "applyIndemniteToBookings", [[bk], indAutre]);
  check("Indemnité d'un autre projet appliquée → refusée", echec(r) && sql(`select count(*) from booking_indemnites where projet_indemnite_id='${indAutre}';`) === "0", r.result);
  r = await call(page, "src/lib/casting/actions.ts", "deleteCastingRole", [role]);
  check("Suppression de rôle refusée → erreur, rôle conservé", echec(r) && sql(`select count(*) from casting_roles where id='${role}';`) === "1", r.status);
  r = await call(page, "src/lib/notifications/actions.ts", "markNotificationsLues", [[notif]]);
  check("Notification non marquée lue → erreur renvoyée", echec(r) && sql(`select (lu_at is null)::text from notifications where id='${notif}';`) === "true", r.result);
  r = await call(page, "src/lib/projets/actions.ts", "archiverProjet", [P]);
  check("Archivage refusé → erreur, projet non archivé et profil temporaire NON supprimé", echec(r) && sql(`select archive::text from projets where id='${P}';`) === "false" && sql(`select count(*) from figurants where id='${tmp}';`) === "1", r.status);
  sql(`delete from bug13_cibles where cle='${P}'; update projets set archive=true, archive_le=now()-interval '2 years' where id='${P}'; insert into bug13_cibles values('${P}');`);
  r = await call(page, "src/lib/projets/actions.ts", "desarchiverProjet", [P]);
  check("Désarchivage refusé → erreur, projet toujours archivé", echec(r) && sql(`select archive::text from projets where id='${P}';`) === "true", r.status);
  r = await call(page, "src/lib/projets/actions.ts", "deleteProjet", [P]);
  check("Suppression de projet refusée → erreur (plus de redirection « réussie »), projet conservé", echec(r) && r.status !== 303 && sql(`select count(*) from projets where id='${P}';`) === "1", r.status);
  // Contrôle inverse : sans blocage, les mêmes actions réussissent.
  sql("delete from bug13_cibles;");
  r = await call(page, "src/lib/indemnites/actions.ts", "deleteProjetIndemnite", [ind]);
  check("Sans blocage : suppression d'indemnité réussie", !echec(r) && sql(`select count(*) from projet_indemnites where id='${ind}';`) === "0", r.result);
  r = await call(page, "src/lib/notifications/actions.ts", "markNotificationsLues", [[notif]]);
  check("Sans blocage : notification marquée lue", !echec(r) && sql(`select (lu_at is not null)::text from notifications where id='${notif}';`) === "true", r.result);
} finally {
  await browser.close();
  sql(`${Object.keys(tables).map((t) => `drop trigger if exists bug13_refuser on public.${t};`).join("\n")}
drop function if exists public.bug13_refuser(); drop table if exists public.bug13_cibles;
delete from notifications where titre='Notif ${M}'; delete from projets where nom like 'Projet ${M}%'; delete from figurants where nom like '${M}%';`);
}
console.table(checks);
assert.deepEqual(checks.filter((c) => !c.ok).map((c) => c.nom), [], "BUG-13 : faux succès détecté");
console.log(`PASS: BUG-13 ${checks.length} contrôles (écritures refusées signalées, données intactes).`);
