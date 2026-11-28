import assert from "node:assert/strict";
import { test } from "node:test";
import { castingVideoPathValid, castingPhotoPathValid, isCastingSubmissionLocked, castingStaffVideoPathValid } from "../src/lib/casting/upload-paths.ts";
const figurant = "11111111-1111-4111-8111-111111111111";
const entry = "22222222-2222-4222-8222-222222222222";
const uuid = "33333333-3333-4333-8333-333333333333";
test("restricts videos to the correct candidate, casting and configured slot", () => {
  assert.equal(castingVideoPathValid(`${figurant}/${entry}-video-0-${uuid}.mp4`, figurant, entry, 1), true);
  assert.equal(castingVideoPathValid(`${figurant}/${entry}-video-1-${uuid}.mp4`, figurant, entry, 1), false);
  assert.equal(castingVideoPathValid(`${figurant}/other-video-0-${uuid}.mp4`, figurant, entry, 1), false);
  assert.equal(castingVideoPathValid(`other/${entry}-video-0-${uuid}.mp4`, figurant, entry, 1), false);
  assert.equal(castingVideoPathValid(`${figurant}/${entry}-video-0-${uuid}.mp4/extra`, figurant, entry, 1), false);
});
test("restricts photos to a configured label and exact entry", () => {
  const path = `${figurant}/casting-${entry}-Portrait%20face-${uuid}.jpg`;
  assert.equal(castingPhotoPathValid(path, figurant, entry, "Portrait face"), true);
  assert.equal(castingPhotoPathValid(path, figurant, entry, "Pied"), false);
  assert.equal(castingPhotoPathValid(`${figurant}/casting-Portrait face-${uuid}.jpg`, figurant, entry, "Portrait face"), false);
});
test("submitted or accepted self-tapes cannot be reopened by a public token", () => {
  assert.equal(isCastingSubmissionLocked({submitted_at: null, statut: "proposé"}), false);
  assert.equal(isCastingSubmissionLocked({submitted_at: new Date().toISOString(), statut: "envoyé"}), true);
  assert.equal(isCastingSubmissionLocked({submitted_at: null, statut: "valide"}), true);
  assert.equal(isCastingSubmissionLocked({submitted_at: null, statut: "annulé"}), true);
});

test("staff video slots stay bound to the candidate and entry without accepting public numbered slots", () => {
 assert.equal(castingStaffVideoPathValid(`${figurant}/${entry}-video-${uuid}.mp4`,figurant,entry),true);
 assert.equal(castingStaffVideoPathValid(`${figurant}/${entry}-video-0-${uuid}.mp4`,figurant,entry),false);
 assert.equal(castingStaffVideoPathValid(`${figurant}/other-video-${uuid}.mp4`,figurant,entry),false);
 assert.equal(castingStaffVideoPathValid(`other/${entry}-video-${uuid}.mp4`,figurant,entry),false);
 assert.equal(castingStaffVideoPathValid(`${figurant}/${entry}-video-${uuid}.mp4/extra`,figurant,entry),false);
});
