import { ageOnDate } from "@/lib/minors/model";
import type { GuardiansData } from "@/lib/minors/model";
export type MinorPreparationInput = {
 project: { id: string; nom: string; societe_production: string | null; realisateur: string | null; lieu: string | null };
 child: { id: string; prenom: string; nom: string; email: string | null; date_naissance: string | null; adresse: string | null; code_postal: string | null; ville: string | null };
 dossier: { id: string; projet_id: string; figurant_id: string; tournage_debut: string | null; tournage_fin: string | null; commission_date: string | null; role_label: string | null; cachet_info: string | null };
 guardians?: GuardiansData;
 bookings: { projet_id: string; figurant_id: string; date: string; fonction: string | null; cachet: string | null }[];
 complete: boolean;
 documents: { label: string; state: string; valid_until: string | null }[];
};
export function buildMinorPreparation(input: MinorPreparationInput) {
 const errors: string[] = [];
 const { project, child, dossier, guardians } = input;
 if (dossier.projet_id !== project.id || dossier.figurant_id !== child.id || input.bookings.some(b => b.projet_id !== project.id || b.figurant_id !== child.id)) errors.push("Les données ne concernent pas un seul enfant et un seul projet.");
 const dateValid = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
 if (!dateValid(dossier.tournage_debut) || !dateValid(dossier.tournage_fin) || dossier.tournage_fin! < dossier.tournage_debut!) errors.push("Renseigner une période de tournage valide.");
 const age = dateValid(dossier.tournage_debut) ? ageOnDate(child.date_naissance, dossier.tournage_debut) : null;
 if (age === null || age >= 18) errors.push("La naissance doit être renseignée et l’enfant doit être mineur au début de la période.");
 if (age !== null && age < 16 && !dateValid(dossier.commission_date)) errors.push("Renseigner la date de commission DRIEETS.");
 if (!project.nom.trim() || !project.societe_production?.trim()) errors.push("Renseigner le nom du projet et la société de production.");
 if (!child.prenom.trim() || !child.nom.trim() || !child.email?.trim() || !child.adresse?.trim() || !child.code_postal?.trim() || !child.ville?.trim()) errors.push("Compléter l’identité, l’email et l’adresse de l’enfant.");
 if (!dossier.role_label?.trim() || !dossier.cachet_info?.trim()) errors.push("Renseigner la fonction prévue et les conditions de rémunération.");
 const validGuardian = (g: GuardiansData["first"]) => [g.prenom,g.nom,g.adresse,g.telephone,g.email].every(v => typeof v === "string" && !!v.trim());
 if (!guardians || !validGuardian(guardians.first) || !("absence_reason" in guardians.second) && !validGuardian(guardians.second)) errors.push("Compléter les représentants légaux.");
 if (guardians && "absence_reason" in guardians.second && !["decede","sans_autorite"].includes(guardians.second.absence_reason)) errors.push("L’exception du second représentant n’est pas documentée.");
 if (guardians && (guardians.first.email.toLowerCase().trim() === child.email?.toLowerCase().trim() || !("absence_reason" in guardians.second) && (guardians.second.email.toLowerCase().trim() === child.email?.toLowerCase().trim() || guardians.first.email.toLowerCase().trim() === guardians.second.email.toLowerCase().trim()))) errors.push("Les emails de l’enfant et des représentants doivent être distincts.");
 if (errors.length) return { errors, data: null };
 return { errors, data: { ...input, guardians: guardians!, age: age!, bookings: [...input.bookings].sort((a,b) => a.date.localeCompare(b.date)) } };
}
export type MinorPreparation = NonNullable<ReturnType<typeof buildMinorPreparation>["data"]>;
