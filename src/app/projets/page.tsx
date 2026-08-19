import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { PROJET_TYPES, type Projet } from "@/lib/projets/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { Clapperboard } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  type?: string;
  confidentiel?: string;
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

  const { data: projets, error } = await query.returns<Projet[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold"><Clapperboard size={28} strokeWidth={1.75} />Projets</h1>
          <p className="mt-1 text-text-muted">
            {projets?.length ?? 0} projet{(projets?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        {isChef && <ButtonLink href="/projets/nouveau">+ Nouveau projet</ButtonLink>}
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4" method="get">
          <Input name="q" placeholder="Nom, réalisateur, société..." defaultValue={params.q} />
          <Select name="type" defaultValue={params.type ?? ""}>
            <option value="">Type (tous)</option>
            {PROJET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select name="confidentiel" defaultValue={params.confidentiel ?? ""}>
            <option value="">Confidentiel (tous)</option>
            <option value="oui">Confidentiel</option>
            <option value="non">Non confidentiel</option>
          </Select>
          <button
            type="submit"
            className="rounded-full bg-ink-raised-2 px-5 py-2.5 text-sm font-medium hover:border hover:border-coral/60"
          >
            Filtrer
          </button>
          <Link
            href="/projets"
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
                    ? `${p.date_debut}${p.date_fin ? ` → ${p.date_fin}` : ""}`
                    : "—"}
                </td>
                <td className="px-6 py-3 text-text-muted">{p.lieu ?? "—"}</td>
                <td className="px-6 py-3">
                  {p.confidentiel && <Badge tone="coral">Confidentiel</Badge>}
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
