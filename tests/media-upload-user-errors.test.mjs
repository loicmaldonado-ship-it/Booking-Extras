import { test } from "node:test";
import assert from "node:assert/strict";
import { translateUploadErrorMessage } from "../src/lib/media/upload-error.ts";

test("traduit les erreurs Storage en messages utilisateur exploitables", () => {
  for (const [input, expected] of [
    ["The object exceeded the maximum allowed size", /trop volumineux/],
    ["Payload Too Large 413", /trop volumineux/],
    ["invalid MIME type", /Format/],
    ["Network request failed", /Connexion/],
    ["upload timed out", /trop de temps/],
    ["Invalid token or expired signature", /expiré/],
    ["Unsupported codec", /appareil/],
    ["AbortError", /annulé/],
  ]) assert.match(translateUploadErrorMessage(input), expected);
});

test("ne renvoie jamais un chemin, token ou détail interne brut", () => {
  const secret = "storage://private-bucket/a/b?token=SECRET_VALUE";
  const output = translateUploadErrorMessage(secret);
  assert.ok(!output.includes("SECRET_VALUE"));
  assert.ok(!output.includes("private-bucket"));
});

test("ne confond pas une annulation avec une confirmation réussie", () => {
  assert.match(translateUploadErrorMessage("AbortError: cancelled"), /annulé/);
  assert.doesNotMatch(translateUploadErrorMessage("AbortError: cancelled"), /envoyé|réussi/i);
});
