import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Résout la signature à utiliser dans les messages envoyés depuis ce
// projet : la signature calibrée sur le projet si elle existe, sinon le
// nom de la cheffe propriétaire — jamais une formule générique du style
// "L'équipe casting", qui masque qui écrit réellement.
export async function getProjetSignatureOrOwnerName(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string | null | undefined
): Promise<string> {
  if (!projetId) return "";

  const { data: projet } = await supabase
    .from("projets")
    .select("signature, owner_id")
    .eq("id", projetId)
    .maybeSingle();
  if (!projet) return "";
  if (projet.signature) return projet.signature;
  if (!projet.owner_id) return "";

  const { data: owner } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("id", projet.owner_id)
    .maybeSingle();
  if (!owner) return "";
  return owner.prenom && owner.nom ? `${owner.prenom} ${owner.nom}` : owner.nom ?? "";
}

// Même résolution que getProjetSignatureOrOwnerName, mais pour une page qui
// mélange plusieurs projets (ex. Candidatures, pas scopée à un seul projet
// actif) — une requête groupée au lieu d'une par ligne.
export async function getProjetSignaturesOrOwnerNames(
  supabase: ReturnType<typeof createAdminClient>,
  projetIds: string[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(projetIds));
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  const { data: projets } = await supabase.from("projets").select("id, signature, owner_id").in("id", ids);
  const ownerIds = Array.from(
    new Set((projets ?? []).filter((p) => !p.signature && p.owner_id).map((p) => p.owner_id as string))
  );
  const { data: owners } =
    ownerIds.length > 0
      ? await supabase.from("profiles").select("id, prenom, nom").in("id", ownerIds)
      : { data: [] as { id: string; prenom: string | null; nom: string | null }[] };
  const ownerNameById = new Map(
    (owners ?? []).map((o) => [o.id, o.prenom && o.nom ? `${o.prenom} ${o.nom}` : o.nom ?? ""])
  );

  for (const p of projets ?? []) {
    result.set(p.id, p.signature || (p.owner_id ? ownerNameById.get(p.owner_id) ?? "" : ""));
  }
  return result;
}

// Identité de la cheffe propriétaire du projet, sans jamais retomber sur la
// signature calibrée — utile pour "posté par" sur les annonces publiques,
// où on veut savoir QUI a publié, pas la formule de politesse des messages.
export async function getProjetOwnerNames(
  supabase: ReturnType<typeof createAdminClient>,
  projetIds: string[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(projetIds));
  const result = new Map<string, string>();
  if (ids.length === 0) return result;

  const { data: projets } = await supabase.from("projets").select("id, owner_id").in("id", ids);
  const ownerIds = Array.from(new Set((projets ?? []).filter((p) => p.owner_id).map((p) => p.owner_id as string)));
  const { data: owners } =
    ownerIds.length > 0
      ? await supabase.from("profiles").select("id, prenom, nom, email").in("id", ownerIds)
      : { data: [] as { id: string; prenom: string | null; nom: string | null; email: string | null }[] };
  const ownerNameById = new Map(
    (owners ?? []).map((o) => [o.id, o.prenom && o.nom ? `${o.prenom} ${o.nom}` : o.nom || o.email || ""])
  );

  for (const p of projets ?? []) {
    result.set(p.id, p.owner_id ? ownerNameById.get(p.owner_id) ?? "" : "");
  }
  return result;
}
