import { nomComplet } from "@/lib/noms";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { GENRES, type Figurant } from "@/lib/figurants/types";
import { buildFigurantsQuery, type FigurantFilters } from "@/lib/figurants/query";
import { comedienPoolClause } from "@/lib/figurants/comedien-privacy";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { FigurantsTrombiGrid } from "@/components/figurants/figurants-trombi-grid";
import { hasActiveMensurationFilters } from "@/lib/figurants/mensuration-filters";
import { MensurationsFilterPanel } from "@/components/figurants/mensurations-filter-panel";
import { ContactIcons } from "@/components/ui/contact-icons";
import { PreviewButton } from "@/components/figurants/figurant-preview-modal";
import { DoublonsPanel, type DoublonGroupe } from "@/components/figurants/doublons-panel";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner, aAccesComplet } from "@/lib/auth/owner";
import { getCurrentProjetId, setCurrentProjet } from "@/lib/projet-context";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = FigurantFilters & { vue?: string; page?: string };

const FIGURANTS_PAR_PAGE = 60;
// Sans accès complet : pas de liste en libre service. Un profil se trouve en
// le cherchant par nom (3 lettres minimum) ou par critères (ville, âge,
// taille, poids…), résultats plafonnés. Le genre seul ne suffit pas.
const RECHERCHE_MIN = 3;
const RESULTATS_MAX = 60;

export default async function FigurantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { vue, page: pageParam, ...filters } = params;
  const isTrombi = vue !== "liste";
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;
  const currentProjetId = await getCurrentProjetId();
  const { data: currentProjet } = currentProjetId
    ? await supabase.from("projets").select("nom").eq("id", currentProjetId).single()
    : { data: null };

  // Pagination — le pool de figurant·es est partagé entre tous les comptes,
  // donc potentiellement des milliers de profils : jamais tout charger (et
  // surtout jamais générer les URL signées des photos) d'un coup. Le
  // compte total vient du même aller-retour que la page (Content-Range),
  // pas d'une requête séparée.
  const libreService = aAccesComplet(profile);
  const recherche = (filters.q ?? "").trim();
  const parCriteres =
    !!(filters.ville || filters.myrole || filters.vehicule || filters.age_min || filters.age_max) ||
    hasActiveMensurationFilters(filters);
  const peutChercher = libreService || recherche.length >= RECHERCHE_MIN || parCriteres;
  const pageParamNum = libreService ? Math.max(1, Number(pageParam) || 1) : 1;
  const parPage = libreService ? FIGURANTS_PAR_PAGE : RESULTATS_MAX;
  const { data: figurants, error, count: totalCount } = peutChercher
    ? await buildFigurantsQuery(supabase, filters, { withCount: true, profile })
        .range((pageParamNum - 1) * parPage, pageParamNum * parPage - 1)
        .returns<Figurant[]>()
    : { data: [] as Figurant[], error: null, count: 0 };
  const totalPages = libreService ? Math.max(1, Math.ceil((totalCount ?? 0) / FIGURANTS_PAR_PAGE)) : 1;
  const page = Math.min(totalPages, pageParamNum);

  const portraitByFigurant = isTrombi
    ? await getPhotosByFigurantId((figurants ?? []).map((f) => f.id))
    : new Map();

  let projetsQuery = supabase.from("projets").select("id, nom").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));
  const { data: projets } = isTrombi ? await projetsQuery : { data: [] };

  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][]
  ).toString();

  const isComediens = filters.profil === "comediens";
  function profilHref(profil: "figurants" | "comediens") {
    const sp = new URLSearchParams(query);
    if (profil === "comediens") sp.set("profil", "comediens");
    else sp.delete("profil");
    if (!isTrombi) sp.set("vue", "liste");
    const qs = sp.toString();
    return `/figurants${qs ? `?${qs}` : ""}`;
  }

  function pageHref(p: number) {
    const sp = new URLSearchParams(query);
    if (!isTrombi) sp.set("vue", "liste");
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/figurants${qs ? `?${qs}` : ""}`;
  }

  let doublonsQuery = supabase
    .from("figurants")
    .select("id, prenom, nom, telephone, email, created_at, est_comedien")
    .not("telephone", "is", null)
    .order("created_at", { ascending: true });
  const doublonsComedienClause = comedienPoolClause(profile);
  if (doublonsComedienClause) doublonsQuery = doublonsQuery.or(doublonsComedienClause);
  const { data: tousLesFigurants } = !libreService
    ? { data: [] }
    : await doublonsQuery.returns<
    { id: string; prenom: string; nom: string; telephone: string | null; email: string | null; created_at: string; est_comedien: boolean }[]
  >();

  // Une fiche comédien·ne et une fiche figurant·e peuvent légitimement
  // partager nom+téléphone (même personne, deux profils voulus — voir
  // comedien-privacy.ts) : la clé inclut est_comedien pour ne pas les
  // signaler comme doublon à fusionner.
  const groupesParCle = new Map<string, DoublonGroupe>();
  for (const f of tousLesFigurants ?? []) {
    const telephoneNormalise = (f.telephone ?? "").replace(/\s+/g, "");
    if (!telephoneNormalise) continue;
    const cle = `${f.nom.trim().toLowerCase()}::${telephoneNormalise}::${f.est_comedien}`;
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
            {libreService
              ? `${totalCount ?? 0} ${isComediens ? "comédien·ne" : "figurant·e"}${(totalCount ?? 0) > 1 ? "s" : ""}`
              : "Cherche un profil par son nom, ou par critères (âge, taille, poids…)."}
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

      {libreService && <DoublonsPanel groupes={doublons} />}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Profil :</span>
        <Link
          href={profilHref("figurants")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !isComediens ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:text-text"
          )}
        >
          Figurant·es
        </Link>
        <Link
          href={profilHref("comediens")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isComediens ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:text-text"
          )}
        >
          Comédien·nes &amp; casting
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Vue :</span>
        <Link
          href={`/figurants?${query ? `${query}&` : ""}vue=liste`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:text-text"
          )}
        >
          Liste
        </Link>
        <Link
          href={`/figurants${query ? `?${query}` : ""}`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:text-text"
          )}
        >
          Trombinoscope
        </Link>
      </div>

      <Card>
        <form className="flex flex-col gap-4" method="get">
          {isComediens && <input type="hidden" name="profil" value="comediens" />}
          {isTrombi === false && <input type="hidden" name="vue" value="liste" />}
          <h2 className="text-sm font-semibold">🔎 Chercher dans la base</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              name="q"
              placeholder={libreService ? "Nom, prénom, email..." : "Nom, prénom, email ou téléphone (3 lettres min.)"}
              defaultValue={params.q}
                          />
            <Input name="ville" placeholder="Ville" defaultValue={params.ville} />
          </div>

          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Genre">
            <span className="text-xs font-medium text-text">Genre :</span>
            {[{ value: "", label: "Tous" }, ...GENRES.map((g) => ({ value: g as string, label: g }))].map((g) => (
              <label key={g.value || "tous"} className="cursor-pointer">
                <input type="radio" name="genre" value={g.value} defaultChecked={(params.genre ?? "") === g.value} className="peer sr-only" />
                <span className="inline-block rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-text peer-checked:border-coral peer-checked:bg-coral peer-checked:text-ink peer-focus-visible:ring-2 peer-focus-visible:ring-coral">
                  {g.label}
                </span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ["Âge", "age_min", "age_max", params.age_min, params.age_max],
                ["Taille (cm)", "taille_min", "taille_max", filters.taille_min, filters.taille_max],
                ["Poids (kg)", "poids_min", "poids_max", filters.poids_min, filters.poids_max],
              ] as const
            ).map(([label, min, max, vMin, vMax]) => (
              <div key={min} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text">{label}</span>
                <div className="flex items-center gap-2">
                  <Input type="number" name={min} placeholder="de" defaultValue={vMin} min={0} aria-label={`${label} minimum`} />
                  <span className="text-xs text-text-muted">à</span>
                  <Input type="number" name={max} placeholder="à" defaultValue={vMax} min={0} aria-label={`${label} maximum`} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select name="myrole" defaultValue={params.myrole ?? ""}>
              <option value="">Compte Myrole (tous)</option>
              <option value="oui">Avec compte Myrole</option>
              <option value="non">Sans compte Myrole</option>
            </Select>
            <Select name="vehicule" defaultValue={params.vehicule ?? ""}>
              <option value="">Véhicule (tous)</option>
              <option value="oui">A un véhicule</option>
              <option value="non">Sans véhicule</option>
              <option value="voiture">Voiture</option>
              <option value="velo">Vélo</option>
              <option value="moto">Moto</option>
              <option value="scooter">Scooter</option>
            </Select>
          </div>

          <MensurationsFilterPanel defaultValues={filters} masques={["taille", "poids"]} />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">🔎 Rechercher</Button>
            <Link href={`/figurants${isComediens ? "?profil=comediens" : ""}`} className="text-sm font-medium text-text hover:text-coral">
              Réinitialiser
            </Link>
            {peutChercher && <span className="text-sm text-text-muted">{totalCount ?? 0} profil{(totalCount ?? 0) > 1 ? "s correspondent" : " correspond"}</span>}
          </div>
        </form>
      </Card>

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.message}
        </div>
      )}

      {!libreService && !peutChercher && (
        <Card className="py-10 text-center text-sm text-text-muted">
          🔎 Cherche un profil par son nom (au moins {RECHERCHE_MIN} lettres du nom, du prénom, de l&apos;email ou du
          téléphone), ou par critères : âge, taille, poids, ville… (le genre seul ne suffit pas, ajoute une fourchette).
        </Card>
      )}
      {!libreService && peutChercher && (totalCount ?? 0) > RESULTATS_MAX && (
        <p className="text-sm text-text-muted">
          {totalCount} profils correspondent : seuls les {RESULTATS_MAX} premiers s&apos;affichent, précise ta recherche.
        </p>
      )}

      {!peutChercher ? null : isTrombi ? (
        <FigurantsTrombiGrid
          figurants={(figurants ?? []).map((f) => ({
            id: f.id,
            prenom: f.prenom,
            nom: f.nom,
            ville: f.ville,
            age: computeAge(f.date_naissance),
            tailleCm: f.taille_cm,
            poidsKg: f.poids_kg,
            telephone: f.telephone,
            email: f.email,
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
              <th className="px-6 py-3 font-medium"></th>
              <th className="px-6 py-3 font-medium">Nom</th>
              <th className="px-6 py-3 font-medium">Âge</th>
              <th className="px-6 py-3 font-medium">Taille</th>
              <th className="px-6 py-3 font-medium">Poids</th>
              <th className="px-6 py-3 font-medium">Ville</th>
              <th className="px-6 py-3 font-medium">Contact</th>
              <th className="px-6 py-3 font-medium">Myrole</th>
              <th className="px-6 py-3 font-medium">Tags</th>
            </tr>
          </thead>
          <tbody>
            {(figurants ?? []).map((f, i) => (
              <tr
                key={f.id}
                className="border-b border-border last:border-0 hover:bg-ink-raised-2"
              >
                <td className="px-3 py-3">
                  <PreviewButton
                    items={(figurants ?? []).map((g) => ({
                      id: g.id,
                      prenom: g.prenom,
                      nom: g.nom,
                      ville: g.ville,
                      portraitUrl: null,
                    }))}
                    index={i}
                  />
                </td>
                <td className="px-6 py-3">
                  <Link href={`/figurants/${f.id}`} className="font-medium hover:text-coral">
                    {nomComplet(f)}
                  </Link>
                  {f.cree_via_casting && (
                    <span className="ml-2" title="Venu·e par un lien de casting, sans compte">
                      <Badge tone="coral">Lien casting</Badge>
                    </span>
                  )}
                </td>
                <td className="px-6 py-3 text-text-muted tabular-nums">
                  {computeAge(f.date_naissance) != null ? `${computeAge(f.date_naissance)} ans` : "—"}
                </td>
                <td className="px-6 py-3 text-text-muted tabular-nums">{f.taille_cm ? `${f.taille_cm} cm` : "—"}</td>
                <td className="px-6 py-3 text-text-muted tabular-nums">{f.poids_kg ? `${f.poids_kg} kg` : "—"}</td>
                <td className="px-6 py-3 text-text-muted">{f.ville ?? "—"}</td>
                <td className="px-6 py-3 text-text-muted">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{f.email ?? f.telephone ?? "—"}</span>
                    <ContactIcons telephone={f.telephone} email={f.email} variant="inline" />
                  </div>
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
                <td colSpan={9} className="px-6 py-10 text-center text-text-muted">
                  Aucun·e figurant·e pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={cn(
              "rounded-full border border-border px-4 py-2 font-medium transition-colors",
              page <= 1 ? "pointer-events-none opacity-40" : "hover:border-coral/60 hover:text-text"
            )}
          >
            ← Précédent
          </Link>
          <span className="text-text-muted">
            Page {page} / {totalPages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= totalPages}
            className={cn(
              "rounded-full border border-border px-4 py-2 font-medium transition-colors",
              page >= totalPages ? "pointer-events-none opacity-40" : "hover:border-coral/60 hover:text-text"
            )}
          >
            Suivant →
          </Link>
        </div>
      )}
    </div>
  );
}
