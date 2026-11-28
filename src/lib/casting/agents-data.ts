import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedSignedUrls } from "@/lib/supabase/signed-urls";
import type { CastingAgent, PropositionAgent } from "./types";

// Agents d'un projet, avec le nombre de propositions de chacun.
export async function getAgents(projetId: string) {
  const supabase = createAdminClient();
  const [{ data: agents }, { data: props }] = await Promise.all([
    supabase.from("casting_agents").select("*").eq("projet_id", projetId).order("created_at").returns<CastingAgent[]>(),
    supabase.from("casting_propositions_agents").select("agent_id, statut").eq("projet_id", projetId),
  ]);
  return (agents ?? []).map((a) => {
    const siennes = (props ?? []).filter((p) => p.agent_id === a.id);
    return {
      ...a,
      nbPropositions: siennes.length,
      nbEnAttente: siennes.filter((p) => p.statut === "en_attente").length,
    };
  });
}

export type PropositionAvecDetails = PropositionAgent & {
  photoUrls: string[];
  agentNom: string;
  agentAgence: string | null;
  roleNom: string;
};

// Boîte de réception : propositions en attente, du plus ancien au plus récent.
export async function getPropositionsEnAttente(projetId: string): Promise<PropositionAvecDetails[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_propositions_agents")
    .select("*, casting_agents(nom, agence), casting_roles(nom)")
    .eq("projet_id", projetId)
    .eq("statut", "en_attente")
    .order("created_at")
    .returns<(PropositionAgent & { casting_agents: { nom: string; agence: string | null } | null; casting_roles: { nom: string } | null })[]>();
  const lignes = data ?? [];
  const chemins = Array.from(new Set(lignes.flatMap((p) => p.photos))).sort();
  const urls = new Map((await getCachedSignedUrls("agent-propositions", chemins)).map((s) => [s.path, s.signedUrl ?? null]));
  return lignes.map((p) => ({
    ...p,
    photoUrls: p.photos.map((c) => urls.get(c)).filter((u): u is string => !!u),
    agentNom: p.casting_agents?.nom ?? "Agent",
    agentAgence: p.casting_agents?.agence ?? null,
    roleNom: p.casting_roles?.nom ?? "Rôle supprimé",
  }));
}

// Nombre de propositions à traiter (pastille du bouton « Agents »).
export async function compterPropositionsEnAttente(projetId: string): Promise<number> {
  const { count } = await createAdminClient()
    .from("casting_propositions_agents")
    .select("id", { count: "exact", head: true })
    .eq("projet_id", projetId)
    .eq("statut", "en_attente");
  return count ?? 0;
}
