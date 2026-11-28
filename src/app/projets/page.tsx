import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { PROJET_TYPES, type Projet } from "@/lib/projets/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { Clapperboard } from "lucide-react";
import { formatDateShort } from "@/lib/format-date";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  type?: string;
  confidentiel?: string;
  archive?: string;
};

export default async function ProjetsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;
  const isChef = profile?.role === "chef";

  let query = supabase
    .from("projets")
    .select("*")
    .order("date_debut", { ascending: false, nullsFirst: false });

  if (accessibleIds !== null) query = query.in("id", idsOrNone(accessibleIds));

  if (params.q) {
    query = query.or(
      `nom.ilike.%${params.q}%,realisateur.ilike.%${params.q}%,societe_production.ilike.%${params.q}%`
    );
  }
  if (params.type) {
    query = query.eq("type", params.type);
  }
  if (params.confidentiel === "oui") {
    query = query.eq("confidentiel", true);
  } else if (params.confidentiel === "non") {
    query = query.eq("confidentiel", false);
  }
  if (params.archive === "oui") {
    query = query.eq("archive", true);
  } else if (params.archive !== "tous") {
    query = query.eq("archive", false);
  }

  const { data: projets, error } = await query.returns<Projet[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold"><Clapperboard size={28} strokeWidth={1.75} />Projets</h1>
          <p className="mt-1 text-text-muted">
            {projets?.length ?? 0} projet{(projets?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        {isChef && <ButtonLink href="/projets/nouveau">+ Nouveau projet</ButtonLink>}
      </div>

      <Card>
        <form autoComplete="off" key={JSON.stringify(params)} className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4" method="get">
          <Input aria-label="Nom, réalisation ou société" name="q" placeholder="Nom, réalisateur·ice, société..." defaultValue={params.q} />
          <Select aria-label="Type de projet" name="type" defaultValue={params.type ?? ""}>
            <option value="">Type (tous)</option>
            {PROJET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select aria-label="Confidentialité" name="confidentiel" defaultValue={params.confidentiel ?? ""}>
            <option value="">Confidentiel (tous)</option>
            <option value="oui">Confidentiel</option>
            <option value="non">Non confidentiel</option>
          </Select>
          <Select aria-label="État d’archivage" name="archive" defaultValue={params.archive ?? "non"}>
            <option value="non">Actifs (non archivés)</option>
            <option value="oui">Archivés</option>
            <option value="tous">Archivés + actifs</option>
          </Select>
          <button
            type="submit"
            className="rounded-full bg-ink-raised-2 px-5 py-2.5 text-sm font-medium hover:border hover:border-coral/60"
          >
            Filtrer
          </button>
          <Link
            href="/projets"
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

      <section className="grid gap-3 md:hidden" aria-label="Liste des projets">
        {(projets ?? []).map((p) => (
          <Card key={p.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Link href={"/projets/" + p.id} className="min-w-0 flex-1 break-words font-semibold hover:text-coral">
                {p.nom}
              </Link>
              <div className="flex flex-wrap gap-1.5">
                {p.confidentiel && <Badge tone="coral">Confidentiel</Badge>}
                {p.archive && <Badge>Archivé</Badge>}
              </div>
            </div>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-text-muted">Type</dt>
              <dd className="min-w-0 break-words">{p.type ?? "—"}</dd>
              <dt className="text-text-muted">Réalisation</dt>
              <dd className="min-w-0 break-words">{p.realisateur ?? "—"}</dd>
              <dt className="text-text-muted">Tournage</dt>
              <dd>
                {p.date_debut ? (
                  <>
                    {formatDateShort(p.date_debut)}
                    {p.date_fin ? " → " + formatDateShort(p.date_fin) : ""}
                  </>
                ) : "—"}
              </dd>
              <dt className="text-text-muted">Lieu</dt>
              <dd className="min-w-0 break-words">{p.lieu ?? "—"}</dd>
            </dl>
          </Card>
        ))}
        {(projets ?? []).length === 0 && !error && (
          <Card className="py-8 text-center text-sm text-text-muted">
            Aucun projet pour l&apos;instant.
          </Card>
        )}
      </section>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-6 py-3 font-medium">Nom</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Réalisateur·ice</th>
              <th className="px-6 py-3 font-medium">Tournage</th>
              <th className="px-6 py-3 font-medium">Lieu</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(projets ?? []).map((p) => (
              <tr
                key={p.id}
                className="border-b border-border last:border-0 hover:bg-ink-raised-2"
              >
                <td className="px-6 py-3">
                  <Link href={`/projets/${p.id}`} className="font-medium hover:text-coral">
                    {p.nom}
                  </Link>
                </td>
                <td className="px-6 py-3 text-text-muted">{p.type ?? "—"}</td>
                <td className="px-6 py-3 text-text-muted">{p.realisateur ?? "—"}</td>
                <td className="px-6 py-3 text-text-muted">
                  {p.date_debut
                    ? `${formatDateShort(p.date_debut)}${p.date_fin ? ` → ${formatDateShort(p.date_fin)}` : ""}`
                    : "—"}
                </td>
                <td className="px-6 py-3 text-text-muted">{p.lieu ?? "—"}</td>
                <td className="px-6 py-3">
                  <div className="flex gap-1.5">
                    {p.confidentiel && <Badge tone="coral">Confidentiel</Badge>}
                    {p.archive && <Badge>Archivé</Badge>}
                  </div>
                </td>
              </tr>
            ))}
            {(projets ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                  Aucun projet pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
