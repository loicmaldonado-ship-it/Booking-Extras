import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import type { AnnonceAvecProjet } from "@/lib/annonces/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
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

  const [{ data: annonces, error }, { data: projets }] = await Promise.all([
    query.returns<AnnonceAvecProjet[]>(),
    projetsQuery,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold"><Megaphone size={28} strokeWidth={1.75} />Annonces</h1>
          <p className="mt-1 text-text-muted">
            {annonces?.length ?? 0} annonce{(annonces?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <ButtonLink href="/annonces/nouveau">+ Nouvelle annonce</ButtonLink>
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4" method="get">
          <Input name="q" placeholder="Titre..." defaultValue={params.q} />
          <Select name="projet_id" defaultValue={params.projet_id ?? ""}>
            <option value="">Projet (tous)</option>
            {(projets ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </Select>
          <Select name="statut" defaultValue={params.statut ?? ""}>
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
            className="col-span-2 flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text md:col-span-1"
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

      <Card className="p-0">
        <table className="w-full text-sm">
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
