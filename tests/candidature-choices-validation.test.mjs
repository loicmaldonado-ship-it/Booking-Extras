import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCandidatureChoices } from "../src/lib/candidatures/validation.ts";

const q = [{ id: "question-1" }, { id: "question-2" }];
const d = [{ id: "date-1" }];
const make = (items) => { const f = new FormData(); for (const [k, v] of items) f.append(k, v); return f; };

test("accepte uniquement les réponses et dates de l'annonce et préserve non=false", () => {
  const f = make([["question_question-1", "oui"], ["question_question-2", "non"], ["date_date-1", "non"], ["question-foreign", "oui"]]);
  assert.deepEqual(validateCandidatureChoices(f, q, d), {
    ok: true,
    reponses: [{ annonce_question_id: "question-1", reponse: true }, { annonce_question_id: "question-2", reponse: false }],
    disponibilites: [{ annonce_date_id: "date-1", disponible: false }],
  });
});

test("rejette toute réponse manquante, falsifiée ou répétée", () => {
  const common = [["question_question-1", "oui"], ["question_question-2", "non"], ["date_date-1", "oui"]];
  for (const changes of [
    common.slice(1),
    [...common.slice(0,2)],
    [...common.slice(0,1), ["question_question-2", "maybe"], common[2]],
    [...common, ["date_date-1", "non"]],
  ]) assert.equal(validateCandidatureChoices(make(changes), q, d).ok, false);
});

test("accepte les annonces sans question ni date", () => {
  assert.deepEqual(validateCandidatureChoices(make([]), [], []), { ok: true, reponses: [], disponibilites: [] });
});

test("l'action de candidature échoue si la lecture échoue et vérifie les erreurs d'insertion", () => {
  const s = readFileSync(new URL("../src/lib/candidatures/actions.ts", import.meta.url), "utf8");
  const start = s.indexOf("export async function postulerAnnonce(");
  const end = s.indexOf("async function enregistrerPhotosCandidature(", start);
  const code = s.slice(start, end);
  assert.ok(code.includes("if (countError || count === null)"));
  assert.ok(code.includes("questionsResult.error || datesResult.error"));
  assert.ok(code.includes("validateCandidatureChoices(formData, questions, annonceDates)"));
  assert.ok(code.includes("if (reponsesError)"));
  assert.ok(code.includes("if (disponibilitesError)"));
  assert.ok(code.includes("if (profilError)"));
});
