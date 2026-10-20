/** Validation côté serveur des réponses attendues pour l'annonce chargée en base. */
export type CandidatureChoices = {
  reponses: { annonce_question_id: string; reponse: boolean }[];
  disponibilites: { annonce_date_id: string; disponible: boolean }[];
};

export function validateCandidatureChoices(
  formData: FormData,
  questions: readonly { id: string }[],
  dates: readonly { id: string }[]
): ({ ok: true } & CandidatureChoices) | { ok: false; error: string } {
  const read = (key: string): boolean | null => {
    // getAll empêche une requête forgée avec plusieurs valeurs concurrentes.
    const values = formData.getAll(key);
    if (values.length !== 1 || (values[0] !== "oui" && values[0] !== "non")) return null;
    return values[0] === "oui";
  };
  const reponses: CandidatureChoices["reponses"] = [];
  for (const question of questions) {
    const reponse = read(`question_${question.id}`);
    if (reponse === null) return { ok: false, error: "Merci de répondre par oui ou non à toutes les questions." };
    reponses.push({ annonce_question_id: question.id, reponse });
  }
  const disponibilites: CandidatureChoices["disponibilites"] = [];
  for (const date of dates) {
    const disponible = read(`date_${date.id}`);
    if (disponible === null) return { ok: false, error: "Merci d'indiquer oui ou non pour chaque disponibilité." };
    disponibilites.push({ annonce_date_id: date.id, disponible });
  }
  return { ok: true, reponses, disponibilites };
}
