// SEC-03 (Storage) : aucun accès direct aux espaces privés avec la clé publique ou une session staff.
// Supabase LOCAL uniquement. Usage : node tests/storage-isolation-local.mjs
// Un fichier fictif est déposé (service_role) dans chaque espace, puis on tente LISTER / LIRE / DÉPOSER / ÉCRASER /
// SUPPRIMER en anonyme et avec la session d'une cheffe. Les espaces publics (avatars, médias d'annonce, logos de
// documents, affiches de références) restent lisibles par conception mais ne doivent jamais être modifiables.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /127\.0\.0\.1|localhost/, "Supabase local uniquement");
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const PRIVATE = ["figurant-photos", "casting-videos", "casting-role-documents", "minor-documents"];
const PUBLIC = ["annonce-medias", "document-templates", "profile-avatars", "references-affiches"];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
import { execFileSync } from "node:child_process";
const DB = process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS";
const svcSql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim();
// Les espaces privés exigent un préfixe = figurant existant (ou dossier mineur) : garde-fou rgpd_block_storage_write.
const FIG = "00000000-0000-4000-8000-00000000f001";
const DOSSIER = svcSql(`insert into minor_dossiers(projet_id,figurant_id) values('00000000-0000-4000-8000-0000000070e0','${FIG}') returning id;`).split("\n").pop();
const stamp = Date.now();
const nameFor = (bucket) => `${bucket === "minor-documents" ? DOSSIER : FIG}/isolation-test-${stamp}.png`;
const h = (key, token) => ({ apikey: key, Authorization: `Bearer ${token ?? key}` });

// Session d'une cheffe fictive
const email = `storage-chef-${Date.now()}@example.test`;
const created = await fetch(`${URL_}/auth/v1/admin/users`, { method: "POST", headers: { ...h(SVC), "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "booking-test-s", email_confirm: true }) }).then((r) => r.json());
const session = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "booking-test-s" }) }).then((r) => r.json());
assert.ok(session.access_token, "Connexion cheffe fictive impossible");

const results = [];
try {
  for (const bucket of [...PRIVATE, ...PUBLIC]) {
    const name = nameFor(bucket);
    const up = await fetch(`${URL_}/storage/v1/object/${bucket}/${name}`, { method: "POST", headers: { ...h(SVC), "Content-Type": "image/png" }, body: PNG });
    assert.ok(up.ok, `Dépôt service_role impossible dans ${bucket}: ${await up.text()}`);
    for (const [who, headers] of [["anonyme", h(ANON)], ["cheffe", h(ANON, session.access_token)]]) {
      const list = await fetch(`${URL_}/storage/v1/object/list/${bucket}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ prefix: name.split("/")[0] + "/", limit: 100, search: "isolation-test" }) });
      const listed = list.ok ? (await list.json()).length : 0;
      const read = await fetch(`${URL_}/storage/v1/object/authenticated/${bucket}/${name}`, { headers });
      const sign = await fetch(`${URL_}/storage/v1/object/sign/${bucket}/${name}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 60 }) });
      const write = await fetch(`${URL_}/storage/v1/object/${bucket}/${name}-intrus.png`, { method: "POST", headers: { ...headers, "Content-Type": "image/png" }, body: PNG });
      const overwrite = await fetch(`${URL_}/storage/v1/object/${bucket}/${name}`, { method: "PUT", headers: { ...headers, "Content-Type": "image/png" }, body: PNG });
      const del = await fetch(`${URL_}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [name] }) });
      const deleted = del.ok ? (await del.json()).length : 0;
      const publicUrl = PUBLIC.includes(bucket) ? (await fetch(`${URL_}/storage/v1/object/public/${bucket}/${name}`)).status : "-";
      results.push({ bucket, who, listed, read: read.status, sign: sign.status, publicUrl, write: write.status, overwrite: overwrite.status, deleted });
    }
  }
} finally {
  for (const bucket of [...PRIVATE, ...PUBLIC]) { const name = nameFor(bucket); await fetch(`${URL_}/storage/v1/object/${bucket}`, { method: "DELETE", headers: { ...h(SVC), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [name, `${name}-intrus.png`] }) }); }
  svcSql(`delete from minor_dossiers where id='${DOSSIER}';`);
  await fetch(`${URL_}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers: h(SVC) });
}
console.table(results);
const failures = results.filter((r) =>
  r.write < 400 || r.overwrite < 400 || r.deleted > 0 || r.listed > 0 ||
  (PRIVATE.includes(r.bucket) && (r.read < 400 || r.sign < 400)) ||
  (PUBLIC.includes(r.bucket) && r.publicUrl !== 200));
assert.deepEqual(failures, [], "Accès direct au stockage non autorisé : " + JSON.stringify(failures));
console.log("PASS: espaces privés illisibles, aucun espace listable ni modifiable en anonyme ou avec une session staff ; fichiers publics servis par leur URL publique.");
