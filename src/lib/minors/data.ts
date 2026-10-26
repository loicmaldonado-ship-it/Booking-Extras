import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readGuardians, type GuardiansData, type Guardian } from "./model";

// Ces helpers ne sont pas des Server Actions. Leurs appelants doivent avoir
// identifié leur propre session ou viennent de créer la fiche dans la même action.
export async function saveGuardiansFromForm(figurantId: string, fd: FormData, birth: string, email: string): Promise<{ error?: string }> {
  const parsed = readGuardians(fd, birth, email);
  if ("error" in parsed) return parsed;
  if (!parsed.data) return {};
  const { error } = await createAdminClient().rpc("save_minor_guardians", { p_id: figurantId, p_data: parsed.data });
  return error ? { error: "Les représentants légaux n’ont pas pu être enregistrés. Vérifie les trois emails et réessaie." } : {};
}

export async function getGuardiansForVerifiedCandidate(figurantId: string): Promise<GuardiansData | undefined> {
  const { data, error } = await createAdminClient().from("minor_guardians").select("position, prenom, nom, adresse, telephone, email, absence_reason").eq("figurant_id", figurantId).order("position");
  if (error || !data || data.length !== 2) return undefined;
  const first = data.find(row => row.position === 1), second = data.find(row => row.position === 2);
  if (!first || !second) return undefined;
  const contact = (row: NonNullable<typeof first>): Guardian => ({ prenom: row.prenom, nom: row.nom, adresse: row.adresse, telephone: row.telephone, email: row.email });
  return { first: contact(first), second: second.absence_reason ? { absence_reason: second.absence_reason } : contact(second) };
}
