import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { AnnonceAvecProjet } from "@/lib/annonces/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { getSiteOrigin } from "@/lib/partage/data";
import { CopyLink } from "@/components/annonces/copy-link";
import { Megaphone } from "lucide-react";
import { formatDateShort } from "@/lib/format-date";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  statut?: string;
  projet_id?: string;
};

export default async function AnnoncesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let query = supabase
    .from("annonces")
    .select("*, projets(nom, confidentiel)")
    .order("date_recherchee", { ascending: false, nullsFirst: false });

  if (accessibleIds !== null) query = query.in("projet_id", idsOrNone(accessibleIds));
  if (params.q) {
    query = query.ilike("titre", `%${params.q}%`);
  }
  if (params.statut) {
    query = query.eq("statut", params.statut);
  }
  if (params.projet_id) {
    query = query.eq("projet_id", params.projet_id);
  }

  let projetsQuery = supabase.from("projets").select("id, nom").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));

  const [{ data: annonces, error }, { data: projets }, origin] = await Promise.all([
    query.returns<AnnonceAvecProjet[]>(),
    projetsQuery,
    getSiteOrigin(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold"><Megaphone size={28} strokeWidth={1.75} />Annonces</h1>
          <p className="mt-1 text-text-muted">
            {annonces?.length ?? 0} annonce{(annonces?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <ButtonLink href="/annonces/nouveau">+ Nouvelle annonce</ButtonLink>
      </div>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Espace candidat·es</h2>
          <p className="text-sm text-text-muted">
            Le lien à partager (Instagram, affiche, réseau...) pour que tout le monde retrouve toutes les
            annonces ouvertes du site, ou se connecte à son espace perso.
          </p>
        </div>
        <CopyLink url={`${origin}/compte/connexion`} />
      </Card>

      <Card>
        <form key={JSON.stringify(params)} className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4" method="get">
          <Input aria-label="Titre de l’annonce" name="q" placeholder="Titre..." defaultValue={params.q} />
          <Select aria-label="Projet" name="projet_id" defaultValue={params.projet_id ?? ""}>
            <option value="">Projet (tous)</option>
            {(projets ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </Select>
          <Select aria-label="Statut" name="statut" defaultValue={params.statut ?? ""}>
            <option value="">Statut (tous)</option>
            <option value="ouverte">Ouverte</option>
            <option value="fermée">Fermée</option>
          </Select>
          <button
            type="submit"
            className="rounded-full bg-ink-raised-2 px-5 py-2.5 text-sm font-medium hover:border hover:border-coral/60"
          >
            Filtrer
          </button>
          <Link
            href="/annonces"
            className="sm:col-span-2 flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-text hover:text-text md:col-span-1"
          >
            Réinitialiser
          </Link>
        </form>
      </Card>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.message}
        </div>
      )}

      <section className="grid gap-3 md:hidden" aria-label="Liste des annonces">
        {(annonces ?? []).map((a) => (
          <Card key={a.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={"/annonces/" + a.id} className="min-w-0 flex-1 break-words font-semibold hover:text-coral">
                {a.titre}
              </Link>
              <Badge tone={a.statut === "ouverte" ? "turquoise" : "default"}>
                {a.statut === "ouverte" ? "Ouverte" : "Fermée"}
              </Badge>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-text-muted">Projet</dt>
              <dd className="min-w-0 break-words">{a.projets?.nom ?? "—"}</dd>
              <dt className="text-text-muted">Date recherchée</dt>
              <dd>{a.date_recherchee ? formatDateShort(a.date_recherchee) : "—"}</dd>
              <dt className="text-text-muted">Lieu</dt>
              <dd className="min-w-0 break-words">{a.lieu ?? "—"}</dd>
            </dl>
          </Card>
        ))}
        {(annonces ?? []).length === 0 && !error && (
          <Card className="py-8 text-center text-sm text-text-muted">
            Aucune annonce pour l&apos;instant.
          </Card>
        )}
      </section>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-6 py-3 font-medium">Titre</th>
              <th className="px-6 py-3 font-medium">Projet</th>
              <th className="px-6 py-3 font-medium">Date recherchée</th>
              <th className="px-6 py-3 font-medium">Lieu</th>
              <th className="px-6 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {(annonces ?? []).map((a) => (
              <tr
                key={a.id}
                className="border-b border-border last:border-0 hover:bg-ink-raised-2"
              >
                <td className="px-6 py-3">
                  <Link href={`/annonces/${a.id}`} className="font-medium hover:text-coral">
                    {a.titre}
                  </Link>
                </td>
                <td className="px-6 py-3 text-text-muted">
                  {a.projets?.nom ?? "—"}
                </td>
                <td className="px-6 py-3 text-text-muted">
                  {a.date_recherchee ? formatDateShort(a.date_recherchee) : "—"}
                </td>
                <td className="px-6 py-3 text-text-muted">{a.lieu ?? "—"}</td>
                <td className="px-6 py-3">
                  <Badge tone={a.statut === "ouverte" ? "turquoise" : "default"}>
                    {a.statut === "ouverte" ? "Ouverte" : "Fermée"}
                  </Badge>
                </td>
              </tr>
            ))}
            {(annonces ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-text-muted">
                  Aucune annonce pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
