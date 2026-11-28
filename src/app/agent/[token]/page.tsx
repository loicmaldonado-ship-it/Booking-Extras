import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { projetNomPublic } from "@/lib/projets/types";
import { formatDateLong } from "@/lib/format-date";
import { ProposerProfilAgent } from "@/components/casting/proposer-profil-agent";

export const dynamic = "force-dynamic";
// Page à un agent précis : pas d'indexation, jamais.
export const metadata = { robots: { index: false, follow: false } };

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RoleAgent = {
  id: string;
  nom: string;
  ordre: number;
  onglet_id: string | null;
  agents_description: string | null;
  agents_age: string | null;
  agents_sequence: string | null;
  agents_repliques: string | null;
  date_limite_envoi: string | null;
};

// Lien spécial agent : les rôles ouverts aux agents et un formulaire pour proposer
// un profil (photos glissées, infos, liens vers sa page de comédien). Chaque agent a
// son propre lien et ne voit que ses propres propositions.
export default async function AgentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const entete = (
    <Link href="/" aria-label="Accueil">
      <Logo iconSize={26} textClassName="text-lg" />
    </Link>
  );
  const supabase = createAdminClient();
  const { data: agent } = TOKEN_RE.test(token)
    ? await supabase
        .from("casting_agents")
        .select("id, projet_id, nom, agence, actif, afficher_repliques, projets(nom, confidentiel, nom_code)")
        .eq("token", token)
        .maybeSingle<{
          id: string;
          projet_id: string;
          nom: string;
          agence: string | null;
          actif: boolean;
          afficher_repliques: boolean;
          projets: { nom: string; confidentiel: boolean; nom_code: string | null } | null;
        }>()
    : { data: null };

  if (!agent || !agent.actif) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        {entete}
        <Card className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">Lien indisponible</h1>
          <p className="text-sm text-text-muted">Ce lien n&apos;est plus actif. Rapproche-toi de la production pour en obtenir un nouveau.</p>
        </Card>
      </div>
    );
  }

  const [{ data: roles }, { data: onglets }, { data: mesPropositions }] = await Promise.all([
    supabase
      .from("casting_roles")
      .select("id, nom, ordre, onglet_id, agents_description, agents_age, agents_sequence, agents_repliques, date_limite_envoi")
      .eq("projet_id", agent.projet_id)
      .eq("ouvert_agents", true)
      .order("ordre")
      .returns<RoleAgent[]>(),
    supabase.from("casting_onglets").select("id, nom, ordre").eq("projet_id", agent.projet_id).order("ordre"),
    // Uniquement SES propositions : le filtre sur agent_id est la frontière entre agents.
    supabase
      .from("casting_propositions_agents")
      .select("id, role_id, prenom, nom, created_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false }),
  ]);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const nomOnglet = new Map((onglets ?? []).map((o) => [o.id, o.nom]));
  const groupes: { cle: string; titre: string | null; roles: RoleAgent[] }[] = [];
  for (const o of onglets ?? []) {
    const dans = (roles ?? []).filter((r) => r.onglet_id === o.id);
    if (dans.length > 0) groupes.push({ cle: o.id, titre: o.nom, roles: dans });
  }
  const sansOnglet = (roles ?? []).filter((r) => !r.onglet_id || !nomOnglet.has(r.onglet_id));
  if (sansOnglet.length > 0) groupes.push({ cle: "autres", titre: groupes.length > 0 ? "Autres rôles" : null, roles: sansOnglet });

  const nomRole = (r: RoleAgent, titre: string | null) =>
    titre && r.nom.startsWith(`${titre} · `) ? r.nom.slice(titre.length + 3) : r.nom;
  const nomRoleParId = new Map((roles ?? []).map((r) => [r.id, r.nom]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      {entete}
      <div>
        <h1 className="text-2xl font-semibold">{projetNomPublic(agent.projets)}</h1>
        <p className="mt-1 text-text-muted">
          Bonjour {agent.nom}{agent.agence ? ` (${agent.agence})` : ""}. Voici les rôles à pourvoir. Pour proposer un
          comédien ou une comédienne, ouvre le rôle, glisse ses photos et renseigne ses infos et le lien vers sa page.
          Seule la production voit tes propositions.
        </p>
      </div>

      {groupes.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Aucun rôle n&apos;est ouvert aux propositions pour l&apos;instant. Reviens bientôt.</p>
        </Card>
      )}

      {groupes.map((g) => (
        <section key={g.cle} className="flex flex-col gap-3">
          {g.titre && <h2 className="text-lg font-semibold">{g.titre}</h2>}
          {g.roles.map((r) => {
            const ferme = !!r.date_limite_envoi && r.date_limite_envoi < aujourdhui;
            const deja = (mesPropositions ?? []).filter((p) => p.role_id === r.id);
            return (
              <Card key={r.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-base font-semibold">{nomRole(r, g.titre)}</h3>
                  {r.agents_age && <span className="text-xs text-text-muted">Âge : {r.agents_age}</span>}
                  {r.agents_sequence && <span className="text-xs text-text-muted">Séq. {r.agents_sequence}</span>}
                  {r.date_limite_envoi && (
                    <span className="text-xs text-text-muted">
                      {ferme ? "Propositions closes" : `Jusqu'au ${formatDateLong(r.date_limite_envoi)}`}
                    </span>
                  )}
                </div>
                {r.agents_description && <p className="whitespace-pre-wrap text-sm">{r.agents_description}</p>}
                {agent.afficher_repliques && r.agents_repliques && (
                  <details className="rounded-lg border border-border bg-ink px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">Répliques d&apos;essai</summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{r.agents_repliques}</p>
                  </details>
                )}
                {deja.length > 0 && (
                  <p className="text-xs text-text-muted">
                    Déjà proposé·es : {deja.map((p) => `${p.prenom} ${p.nom}`).join(", ")}
                  </p>
                )}
                {ferme ? null : <ProposerProfilAgent token={token} roleId={r.id} roleNom={nomRole(r, g.titre)} />}
              </Card>
            );
          })}
        </section>
      ))}

      {(mesPropositions ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Tes propositions envoyées</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {(mesPropositions ?? []).map((p) => (
              <li key={p.id} className="text-text-muted">
                {p.prenom} {p.nom} — {nomRoleParId.get(p.role_id) ?? "rôle"} · {new Date(p.created_at).toLocaleDateString("fr-FR")}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
