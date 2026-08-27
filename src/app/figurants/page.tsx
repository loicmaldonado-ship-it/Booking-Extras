import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { Figurant } from "@/lib/figurants/types";
import { buildFigurantsQuery, type FigurantFilters } from "@/lib/figurants/query";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { FigurantsTrombiGrid } from "@/components/figurants/figurants-trombi-grid";
import { MensurationsFilterPanel } from "@/components/figurants/mensurations-filter-panel";
import { DoublonsPanel, type DoublonGroupe } from "@/components/figurants/doublons-panel";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { getCurrentProjetId, setCurrentProjet } from "@/lib/projet-context";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = FigurantFilters & { vue?: string };

export default async function FigurantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { vue, ...filters } = params;
  const isTrombi = vue !== "liste";
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;
  const currentProjetId = await getCurrentProjetId();
  const { data: currentProjet } = currentProjetId
    ? await supabase.from("projets").select("nom").eq("id", currentProjetId).single()
    : { data: null };

  const { data: figurants, error } = await buildFigurantsQuery(supabase, filters).returns<
    Figurant[]
  >();

  const portraitByFigurant = isTrombi
    ? await getPhotosByFigurantId((figurants ?? []).map((f) => f.id))
    : new Map();

  let projetsQuery = supabase.from("projets").select("id, nom").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));
  const { data: projets } = isTrombi ? await projetsQuery : { data: [] };

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString();

  const { data: tousLesFigurants } = await supabase
    .from("figurants")
    .select("id, prenom, nom, telephone, email, created_at")
    .not("telephone", "is", null)
    .order("created_at", { ascending: true })
    .returns<{ id: string; prenom: string; nom: string; telephone: string | null; email: string | null; created_at: string }[]>();

  const groupesParCle = new Map<string, DoublonGroupe>();
  for (const f of tousLesFigurants ?? []) {
    const telephoneNormalise = (f.telephone ?? "").replace(/\s+/g, "");
    if (!telephoneNormalise) continue;
    const cle = `${f.nom.trim().toLowerCase()}::${telephoneNormalise}`;
    const groupe = groupesParCle.get(cle) ?? { key: cle, nom: f.nom, telephone: telephoneNormalise, profils: [] };
    groupe.profils.push({ id: f.id, prenom: f.prenom, email: f.email, created_at: f.created_at });
    groupesParCle.set(cle, groupe);
  }
  const doublons: DoublonGroupe[] = Array.from(groupesParCle.values()).filter((g) => g.profils.length > 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold"><Users size={28} strokeWidth={1.75} />Base Profils</h1>
          <p className="mt-1 text-text-muted">
            {figurants?.length ?? 0} profil{(figurants?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentProjetId && currentProjet && (
            <form action={setCurrentProjet.bind(null, currentProjetId, "/bookings")}>
              <Button type="submit" variant="secondary">
                📋 Bookings — {currentProjet.nom}
              </Button>
            </form>
          )}
          <ButtonLink href="/figurants/nouveau">+ Nouveau profil</ButtonLink>
        </div>
      </div>

      <DoublonsPanel groupes={doublons} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Vue :</span>
        <Link
          href={`/figurants?${query ? `${query}&` : ""}vue=liste`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          Liste
        </Link>
        <Link
          href={`/figurants${query ? `?${query}` : ""}`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          Trombinoscope
        </Link>
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4" method="get">
          <Input name="q" placeholder="Nom, prénom, email..." defaultValue={params.q} />
          <Input name="ville" placeholder="Ville" defaultValue={params.ville} />
          <Select name="myrole" defaultValue={params.myrole ?? ""}>
            <option value="">Compte Myrole (tous)</option>
            <option value="oui">Avec compte Myrole</option>
            <option value="non">Sans compte Myrole</option>
          </Select>
          <Select name="vehicule" defaultValue={params.vehicule ?? ""}>
            <option value="">Véhicule (tous)</option>
            <option value="oui">A un véhicule</option>
            <option value="non">Sans véhicule</option>
            <option value="velo">Vélo</option>
            <option value="moto">Moto</option>
            <option value="scooter">Scooter</option>
          </Select>
          <MensurationsFilterPanel defaultValues={filters} />
          <button
            type="submit"
            className="col-span-2 rounded-full bg-ink-raised-2 px-5 py-2.5 text-sm font-medium hover:border hover:border-coral/60 md:col-span-1"
          >
            Filtrer
          </button>
          <Link
            href="/figurants"
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

      {isTrombi ? (
        <FigurantsTrombiGrid
          figurants={(figurants ?? []).map((f) => ({
            id: f.id,
            prenom: f.prenom,
            nom: f.nom,
            ville: f.ville,
            portraitUrl: pickPortrait(portraitByFigurant.get(f.id))?.url ?? null,
            photos: portraitByFigurant.get(f.id) ?? [],
          }))}
          projets={projets ?? []}
          canSelectAll={isOwner(profile)}
        />
      ) : (
      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-6 py-3 font-medium">Nom</th>
              <th className="px-6 py-3 font-medium">Ville</th>
              <th className="px-6 py-3 font-medium">Contact</th>
              <th className="px-6 py-3 font-medium">Myrole</th>
              <th className="px-6 py-3 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {(figurants ?? []).map((f) => (
              <tr
                key={f.id}
                className="border-b border-border last:border-0 hover:bg-ink-raised-2"
              >
                <td className="px-6 py-3">
                  <Link href={`/figurants/${f.id}`} className="font-medium hover:text-coral">
                    {f.prenom} {f.nom}
                  </Link>
                </td>
                <td className="px-6 py-3 text-text-muted">{f.ville ?? "—"}</td>
                <td className="px-6 py-3 text-text-muted">
                  {f.email ?? f.telephone ?? "—"}
                </td>
                <td className="px-6 py-3">
                  {f.compte_myrole ? (
                    <Badge tone="turquoise">Oui</Badge>
                  ) : (
                    <Badge>Non</Badge>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="flex flex-wrap gap-1">
                    {f.tags.map((t) => (
                      <Badge key={t} tone="yellow">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {(figurants ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-text-muted">
                  Aucun·e figurant·e pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      )}
    </div>
  );
}
