import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { Select } from "@/components/ui/field";
import { BackLink } from "@/components/ui/back-link";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { getCastingRoles, getCastingEntries } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { paginateGroupedItems } from "@/lib/documents/trombi";
import { GENRES } from "@/lib/figurants/types";
import { CASTING_STATUTS } from "@/lib/casting/types";
import { Badge } from "@/components/ui/card";
import { getCurrentProjetId } from "@/lib/projet-context";
import { requireProjetAccess } from "@/lib/auth/session";
import type { CastingEntry } from "@/lib/casting/types";

type SearchParams = {
  genre?: string;
  vehicule?: string;
  myrole?: string;
  age_min?: string;
  age_max?: string;
  statut?: string;
  valides_uniquement?: string;
};

type TrombiItem = { entry: CastingEntry; headerLabel: string };

function agentLine(entry: CastingEntry): string {
  const f = entry.figurants;
  if (!f) return "SANS AGENT";
  const contact = f.agent_email || f.agent_telephone || "";
  if (!f.agent_nom && !contact && !f.agent_agence) return "SANS AGENT";
  const nomAgence = [f.agent_nom, f.agent_agence].filter(Boolean).join(" · ");
  return [nomAgence || "Agent", contact].filter(Boolean).join(" — ");
}

export default async function CastingTrombisPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const projetId = await getCurrentProjetId();
  await requireProjetAccess(projetId);

  if (!projetId) {
    return <p className="text-text-muted">Choisis un projet depuis Casting.</p>;
  }

  const supabase = createAdminClient();
  const [{ data: projet }, roles, entries] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projetId).single(),
    getCastingRoles(projetId),
    getCastingEntries(projetId),
  ]);

  const portraitByFigurant = await getPhotosByFigurantId(entries.map((e) => e.figurant_id));

  let filtered = entries;
  if (params.genre) filtered = filtered.filter((e) => e.figurants?.genre === params.genre);
  if (params.vehicule === "oui") filtered = filtered.filter((e) => e.figurants?.a_vehicule);
  else if (params.vehicule === "non") filtered = filtered.filter((e) => e.figurants?.a_vehicule === false);
  else if (params.vehicule === "velo") filtered = filtered.filter((e) => e.figurants?.vehicule_velo);
  else if (params.vehicule === "moto") filtered = filtered.filter((e) => e.figurants?.vehicule_moto);
  else if (params.vehicule === "scooter") filtered = filtered.filter((e) => e.figurants?.vehicule_scooter);
  if (params.myrole === "oui") filtered = filtered.filter((e) => e.figurants?.compte_myrole);
  else if (params.myrole === "non") filtered = filtered.filter((e) => !e.figurants?.compte_myrole);
  const ageMin = params.age_min ? Number(params.age_min) : null;
  const ageMax = params.age_max ? Number(params.age_max) : null;
  if (ageMin !== null || ageMax !== null) {
    filtered = filtered.filter((e) => {
      const age = computeAge(e.figurants?.date_naissance ?? null);
      if (age === null) return false;
      if (ageMin !== null && age < ageMin) return false;
      if (ageMax !== null && age > ageMax) return false;
      return true;
    });
  }
  if (params.valides_uniquement === "on") filtered = filtered.filter((e) => e.statut === "valide");
  else if (params.statut) filtered = filtered.filter((e) => e.statut === params.statut);

  // Rangé par rôle — l'ordre des rôles suit getCastingRoles (par date de
  // tournage), puis les profils du rôle triés par nom de famille.
  const entriesByRole = new Map<string, typeof entries>();
  for (const e of filtered) {
    const list = entriesByRole.get(e.role_id) ?? [];
    list.push(e);
    entriesByRole.set(e.role_id, list);
  }
  for (const list of entriesByRole.values()) {
    list.sort((a, b) => (a.figurants?.nom ?? "").localeCompare(b.figurants?.nom ?? ""));
  }

  const items: TrombiItem[] = roles.flatMap((role) =>
    (entriesByRole.get(role.id) ?? []).map((entry) => ({ entry, headerLabel: role.nom }))
  );
  // Cartes un peu plus grandes que le trombi standard (w-28/h-36 au lieu de
  // w-24/h-32) — colonnes/lignes recalibrées en conséquence pour une page
  // paysage (1123×794).
  const pages = paginateGroupedItems(items, (i) => i.headerLabel, { columns: 7, maxRowsPerPage: 3 });

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/casting" label="Casting" />

      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Trombis — {projet?.nom}</h1>
          <p className="mt-1 text-text-muted">
            {filtered.length} profil{filtered.length > 1 ? "s" : ""} sur {roles.length} rôle{roles.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`trombis-casting-${projet?.nom ?? "projet"}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <form className="print-hide grid grid-cols-2 gap-3 md:grid-cols-5" method="get">
        <Select name="genre" defaultValue={params.genre ?? ""}>
          <option value="">Genre (tous)</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Select name="vehicule" defaultValue={params.vehicule ?? ""}>
          <option value="">Véhicule (tous)</option>
          <option value="oui">A un véhicule</option>
          <option value="non">Sans véhicule</option>
          <option value="velo">Vélo</option>
          <option value="moto">Moto</option>
          <option value="scooter">Scooter</option>
        </Select>
        <Select name="myrole" defaultValue={params.myrole ?? ""}>
          <option value="">Myrole (tous)</option>
          <option value="oui">Avec compte Myrole</option>
          <option value="non">Sans compte Myrole</option>
        </Select>
        <Select name="statut" defaultValue={params.statut ?? ""}>
          <option value="">Statut (tous)</option>
          {CASTING_STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <input type="number" name="age_min" placeholder="Âge min" defaultValue={params.age_min} className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral" />
          <input type="number" name="age_max" placeholder="Âge max" defaultValue={params.age_max} className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral" />
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input type="checkbox" name="valides_uniquement" defaultChecked={params.valides_uniquement === "on"} className="h-4 w-4 rounded border-border accent-turquoise" />
          Validé·es uniquement
        </label>
        <button type="submit" className="col-span-2 rounded-full bg-ink-raised-2 px-5 py-2.5 text-sm font-medium hover:border hover:border-coral/60 md:col-span-2">
          Filtrer
        </button>
        <Link href="/casting/trombis" className="col-span-2 flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text md:col-span-1">
          Réinitialiser
        </Link>
      </form>

      {pages.length === 0 && (
        <PrintSheet orientation="landscape">
          <h2 className="text-xl font-semibold text-gray-900">Trombis — {projet?.nom}</h2>
          <p className="py-6 text-center text-gray-500">Aucun profil pour ce filtre.</p>
        </PrintSheet>
      )}

      {pages.map((page, pageIndex) => (
        <PrintSheet
          key={pageIndex}
          orientation="landscape"
          fixedHeight
          className="break-after-page print:break-after-page"
          pageLabel={pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : undefined}
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-gray-900">Trombis — {projet?.nom}</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {page.map((item, index) => {
                const showHeader = index === 0 || item.headerLabel !== page[index - 1].headerLabel;
                const portraitUrl = pickPortrait(portraitByFigurant.get(item.entry.figurant_id), projetId)?.url ?? null;
                return (
                  <Fragment key={item.entry.id}>
                    {showHeader && (
                      <div className="mt-1 w-full border-b border-gray-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 first:mt-0">
                        {item.headerLabel}
                      </div>
                    )}
                    <div className="flex w-28 flex-col items-center gap-0.5 text-center">
                      <div className="relative h-36 w-28 overflow-hidden rounded bg-gray-100">
                        {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />}
                        {item.entry.statut === "valide" && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="block w-28 truncate text-[10px] font-medium leading-tight text-gray-900">
                        {item.entry.figurants?.prenom} {item.entry.figurants?.nom}
                      </span>
                      <span className="block w-28 truncate text-[8px] leading-tight text-gray-500">
                        {agentLine(item.entry)}
                      </span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </PrintSheet>
      ))}

      {pages.length > 0 && (
        <div className="print-hide flex flex-wrap gap-2">
          {roles.map((role) => {
            const roleEntries = entriesByRole.get(role.id) ?? [];
            if (roleEntries.length === 0) return null;
            return (
              <Badge key={role.id} tone="turquoise">
                {role.nom} ({roleEntries.length})
              </Badge>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && <p className="print-hide text-text-muted">Aucun profil pour ce filtre.</p>}
    </div>
  );
}
