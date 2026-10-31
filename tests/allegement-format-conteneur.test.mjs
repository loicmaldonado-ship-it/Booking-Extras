// Audit du 31/10/2026 : ffmpeg ne reçoit plus que des conteneurs vidéo reconnus à leurs premiers octets (démultiplexeur
// imposé) ; une liste de lecture HLS/concat déguisée en .mp4 n'est pas traitée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync(new URL("../src/lib/casting/allegement.ts", import.meta.url), "utf8");
const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const out = {};
new Function("require", "exports", code)((n) => (n === "server-only" ? {} : n.startsWith("node:") ? {} : { createAdminClient() {} }), out);
const b = (s) => Buffer.from(s, "latin1");

test("MP4 / MOV / 3GP (boîte ftyp) → mov", () => assert.equal(out.formatConteneur(b("\0\0\0\x18ftypmp42\0\0\0\0")), "mov"));
test("WebM / Matroska (EBML) → matroska", () => assert.equal(out.formatConteneur(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 0, 0, 0])), "matroska"));
test("AVI (RIFF…AVI) → avi", () => assert.equal(out.formatConteneur(b("RIFF\0\0\0\0AVI LIST")), "avi"));
for (const [nom, contenu] of [["liste HLS", "#EXTM3U\n#EXTINF:1,\nfile:///etc/passwd\n"], ["liste concat", "ffconcat version 1.0\nfile /etc/passwd\n"], ["page HTML", "<html><script>"], ["vide", ""]]) {
  test(`${nom} → refusé`, () => assert.equal(out.formatConteneur(b(contenu)), null));
}
test("ffmpeg lit avec le format imposé et le seul protocole file", () => {
  assert.match(src, /"-protocol_whitelist", "file", "-f", format, "-i", entree/);
  assert.doesNotMatch(src, /"-y", "-i", entree/);
});
