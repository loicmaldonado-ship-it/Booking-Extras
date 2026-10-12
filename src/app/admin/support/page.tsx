import { LifeBuoy } from "lucide-react";
import { getCurrentProfile, getSupportChefId, profileDisplayName } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { entrerModeSupport, quitterModeSupport } from "@/lib/auth/support";
import { Card, Badge } from "@/components/ui/card";
import { BackLink } from "@/components/ui/back-link";
import { formatDateTime } from "@/lib/format-date";

export const dynamic = "force-dynamic";

// Mode support : point d'entrée, à part de la page Admin, pour aller voir
// l'espace d'une autre cheffe exactement comme elle le voit (bandeau sur
// chaque page, ses projets à la place des tiens), sans rien mélanger.
export default async function SupportPage() {
  const profile = await getCurrentProfile();
  if (!isOwner(profile)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Mode support</h1>
        <Card>
          <p className="text-sm text-text-muted">Cette page est réservée au compte propriétaire.</p>
        </Card>
      </div>
    );
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const supportChefId = await getSupportChefId(profile);

  const [{ data: chefsRaw }, { data: usersList }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, nom, prenom, last_seen_at")
      .eq("role", "chef")
      .neq("id", profile!.id)
      .returns<{ id: string; email: string | null; nom: string | null; prenom: string | null; last_seen_at: string | null }[]>(),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const chefs = (chefsRaw ?? []).sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""));
  const chefIds = chefs.map((c) => c.id);
  const revoquee = new Map(
    (usersList?.users ?? []).map((u) => [u.id, !!u.banned_until && new Date(u.banned_until) > new Date()])
  );

  const { data: projets } =
    chefIds.length > 0
      ? await supabase
          .from("projets")
          .select("id, nom, owner_id, created_at")
          .eq("archive", false)
          .in("owner_id", chefIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; nom: string; owner_id: string; created_at: string }[] };
  const projetIds = (projets ?? []).map((p) => p.id);

  const { data: annoncesOuvertes } =
    projetIds.length > 0
      ? await supabase.from("annonces").select("id, projet_id").eq("statut", "ouverte").in("projet_id", projetIds)
      : { data: [] as { id: string; projet_id: string }[] };

  // Comptages par annonce / par projet (quelques dizaines au plus) : des
  // requêtes « head » plutôt que de rapatrier des milliers de lignes.
  const [aTrierParAnnonce, bookingsParProjet] = await Promise.all([
    Promise.all(
      (annoncesOuvertes ?? []).map(async (a) => {
        const { count } = await supabase
          .from("candidatures")
          .select("id", { count: "exact", head: true })
          .eq("annonce_id", a.id)
          .is("onglet_id", null)
          .is("envoyee_en_booking_le", null);
        return [a.projet_id, count ?? 0] as const;
      })
    ),
    Promise.all(
      projetIds.map(async (id) => {
        const { count } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("projet_id", id)
          .gte("date", today);
        return [id, count ?? 0] as const;
      })
    ),
  ]);

  const annoncesParProjet = new Map<string, number>();
  for (const a of annoncesOuvertes ?? []) annoncesParProjet.set(a.projet_id, (annoncesParProjet.get(a.projet_id) ?? 0) + 1);
  const aTrierParProjet = new Map<string, number>();
  for (const [projetId, n] of aTrierParAnnonce) aTrierParProjet.set(projetId, (aTrierParProjet.get(projetId) ?? 0) + n);
  const bookingsAVenir = new Map(bookingsParProjet);
  const projetsParChef = new Map<string, { id: string; nom: string }[]>();
  for (const p of projets ?? []) {
    const liste = projetsParChef.get(p.owner_id) ?? [];
    liste.push(p);
    projetsParChef.set(p.owner_id, liste);
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <BackLink href="/admin" label="Retour à Admin" />
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <LifeBuoy size={28} strokeWidth={1.75} />
          Mode support
        </h1>
        <p className="mt-1 max-w-3xl text-text-muted">
          Ouvre l&apos;espace d&apos;une cheffe pour voir le site exactement comme elle le voit : ses projets, ses
          annonces, ses candidatures et ses bookings, à la place des tiens. Un bandeau jaune te le rappelle sur
          chaque page. Tu as un accès complet : ce que tu modifies s&apos;applique à ses projets. Ses notifications ne
          sont pas marquées comme lues quand tu les ouvres.
        </p>
      </div>

      {supportChefId && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-yellow/50 bg-yellow/10">
          <p className="text-sm">
            Tu es en mode support. Choisis une autre cheffe ci-dessous ou reviens à ton espace.
          </p>
          <form action={quitterModeSupport}>
            <button type="submit" className="rounded-full bg-yellow px-4 py-2 text-sm font-semibold text-white">
              Quitter le mode support
            </button>
          </form>
        </Card>
      )}

      {chefs.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">Aucune autre cheffe pour l&apos;instant.</p>
        </Card>
      )}

      {chefs.map((c) => {
        const leursProjets = projetsParChef.get(c.id) ?? [];
        const enCours = supportChefId === c.id;
        return (
          <Card key={c.id} className={enCours ? "flex flex-col gap-4 border-yellow/60" : "flex flex-col gap-4"}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{profileDisplayName(c) ?? c.email}</h2>
                  {enCours && <Badge>Espace ouvert</Badge>}
                  {revoquee.get(c.id) && <Badge tone="danger">Accès révoqué</Badge>}
                  {!c.last_seen_at && <Badge tone="danger">Jamais connectée</Badge>}
                </div>
                <p className="text-xs text-text-muted">
                  {c.email}
                  {c.last_seen_at && <> · Dernière connexion {formatDateTime(c.last_seen_at)}</>}
                </p>
              </div>
              <form action={entrerModeSupport.bind(null, c.id, undefined)}>
                <button
                  type="submit"
                  className="rounded-full bg-yellow px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Ouvrir son espace →
                </button>
              </form>
            </div>

            {leursProjets.length === 0 ? (
              <p className="text-sm text-text-muted">Aucun projet en cours.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-muted">
                      <th className="py-2 pr-4 font-medium">Projet</th>
                      <th className="py-2 pr-4 font-medium tabular-nums">Annonces ouvertes</th>
                      <th className="py-2 pr-4 font-medium tabular-nums">Candidatures à trier</th>
                      <th className="py-2 pr-4 font-medium tabular-nums">Bookings à venir</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {leursProjets.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium">{p.nom}</td>
                        <td className="py-2 pr-4 tabular-nums">{annoncesParProjet.get(p.id) ?? 0}</td>
                        <td className="py-2 pr-4 tabular-nums">{aTrierParProjet.get(p.id) ?? 0}</td>
                        <td className="py-2 pr-4 tabular-nums">{bookingsAVenir.get(p.id) ?? 0}</td>
                        <td className="py-2 text-right">
                          <form action={entrerModeSupport.bind(null, c.id, p.id)}>
                            <button type="submit" className="text-xs font-medium text-coral hover:underline">
                              Ouvrir ce projet →
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      <p className="text-xs text-text-muted">
        Pour revenir à tes projets : « Quitter le mode support » dans le bandeau jaune. Le mode support se coupe
        tout seul au bout de 8 heures.
      </p>
    </div>
  );
}
