import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { getSiteOrigin } from "@/lib/partage/data";
import { getCastingRoles } from "@/lib/casting/data";
import { getAgents, getPropositionsEnAttente } from "@/lib/casting/agents-data";
import { GestionAgents } from "@/components/casting/gestion-agents";
import { EnvoiAgents } from "@/components/casting/envoi-agents";
import { BoiteReceptionAgents } from "@/components/casting/boite-reception-agents";
import { Handshake } from "lucide-react";

export const dynamic = "force-dynamic";

// Lien spécial agent : un lien par agent, qui montre les rôles ouverts aux agents
// et reçoit leurs propositions de profils (photos, infos, lien vers leur page).
export default async function AgentsPage() {
  const supabase = createAdminClient();
  const projetId = await getCurrentProjetId();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  async function projets() {
    let q = supabase.from("projets").select("id, nom, confidentiel").eq("archive", false).order("nom");
    if (accessibleIds !== null) q = q.in("id", idsOrNone(accessibleIds));
    return (await q).data ?? [];
  }
  if (!projetId || (!isOwner(profile) && accessibleIds !== null && !accessibleIds.includes(projetId))) {
    return <ProjetPicker projets={await projets()} redirectTo="/casting/agents" sectionLabel="Casting" />;
  }
  const { data: projet } = await supabase.from("projets").select("nom").eq("id", projetId).single();
  if (!projet) return <ProjetPicker projets={await projets()} redirectTo="/casting/agents" sectionLabel="Casting" />;

  const [agents, propositions, roles, origin] = await Promise.all([
    getAgents(projetId),
    getPropositionsEnAttente(projetId),
    getCastingRoles(projetId),
    getSiteOrigin(),
  ]);
  const ouverts = roles.filter((r) => r.ouvert_agents);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Projet actuel
          <Link href="/casting" className="ml-2 text-coral hover:underline">
            ← Retour au casting
          </Link>
        </p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Handshake size={28} strokeWidth={1.75} />
          Agents
        </h1>
        <p className="mt-1 text-text-muted">
          {projet.nom} — un lien par agent : il voit les rôles que tu lui ouvres et te propose des profils (photos, infos,
          lien vers sa page de comédien). Il ne voit jamais les propositions des autres agents.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm">
          <strong>{ouverts.length}</strong> rôle{ouverts.length > 1 ? "s" : ""} ouvert{ouverts.length > 1 ? "s" : ""} aux agents sur {roles.length}.
        </span>
        <span className="text-xs text-text-muted">
          Tu les choisis dans Casting : bouton « 🤝 Agents » sur chaque carte, ou « 👁️ Visibilité au réal » pour tous les rôles affichés d&apos;un coup.
        </span>
        <Link href="/casting" className="ml-auto rounded-full border-2 border-border-strong px-4 py-1.5 text-sm font-semibold hover:border-coral">
          Choisir les rôles
        </Link>
      </Card>

      <BoiteReceptionAgents
        propositions={propositions.map((p) => ({
          id: p.id,
          agentNom: p.agentNom,
          agentAgence: p.agentAgence,
          roleNom: p.roleNom,
          prenom: p.prenom,
          nom: p.nom,
          age: p.age,
          taille: p.taille,
          lienPage: p.lien_page,
          lienBandeDemo: p.lien_bande_demo,
          note: p.note,
          photoUrls: p.photoUrls,
          creeLe: p.created_at,
        }))}
      />

      <EnvoiAgents
        projetId={projetId}
        liens={agents.map((a) => ({
          id: a.id,
          baseId: a.agent_id,
          nom: a.nom,
          agence: a.agence,
          email: a.email,
          actif: a.actif,
          dernierEnvoi: a.dernier_envoi_le,
        }))}
      />

      <GestionAgents
        projetId={projetId}
        origin={origin}
        agents={agents.map((a) => ({
          id: a.id,
          nom: a.nom,
          agence: a.agence,
          email: a.email,
          token: a.token,
          actif: a.actif,
          afficherRepliques: a.afficher_repliques,
          dansLaBase: !!a.agent_id,
          nbPropositions: a.nbPropositions,
          nbEnAttente: a.nbEnAttente,
        }))}
      />
    </div>
  );
}
