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
import { hasActiveMensurationFilters, MENSURATION_RANGE_FIELDS, MENSURATION_TEXT_FIELDS } from "@/lib/figurants/mensuration-filters";
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
  const criteresActifs = Boolean(recherche || parCriteres || filters.genre);
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
  const previewItems = (figurants ?? []).map((g) => ({
    id: g.id, prenom: g.prenom, nom: g.nom, ville: g.ville, portraitUrl: null,
  }));

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

        {libreService && <DoublonsPanel groupes={doublons} canDelete={isOwner(profile)} />}

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
        <form key={query} className="flex flex-col gap-4" method="get">
          {isComediens && <input type="hidden" name="profil" value="comediens" />}
          {isTrombi === false && <input type="hidden" name="vue" value="liste" />}
          <Input aria-label="Nom, prénom ou email" name="q" placeholder="Nom, prénom, email..." defaultValue={params.q} />
          <Input aria-label="Ville" name="ville" placeholder="Ville" defaultValue={params.ville} />
          <Select aria-label="Compte Myrole" name="myrole" defaultValue={params.myrole ?? ""}>
            <option value="">Compte Myrole (tous)</option>
            <option value="oui">Avec compte Myrole</option>
            <option value="non">Sans compte Myrole</option>
          </Select>
          <Select aria-label="Véhicule" name="vehicule" defaultValue={params.vehicule ?? ""}>
            <option value="">Véhicule (tous)</option>
            <option value="oui">A un véhicule</option>
            <option value="non">Sans véhicule</option>
            <option value="voiture">Voiture</option>
            <option value="velo">Vélo</option>
            <option value="moto">Moto</option>
            <option value="scooter">Scooter</option>
          </Select>
          <Select aria-label="Genre" name="genre" defaultValue={params.genre ?? ""}>
            <option value="">Genre (tous)</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <Input aria-label="Âge minimum" type="number" name="age_min" placeholder="Âge min" defaultValue={params.age_min} min={0} />
            <Input aria-label="Âge maximum" type="number" name="age_max" placeholder="Âge max" defaultValue={params.age_max} min={0} />
          </div>
          <div className="flex gap-2">
            <Input aria-label="Taille minimum en centimètres" type="number" name="taille_min" placeholder="Taille min (cm)" defaultValue={params.taille_min} min={0} />
            <Input aria-label="Taille maximum en centimètres" type="number" name="taille_max" placeholder="Taille max (cm)" defaultValue={params.taille_max} min={0} />
          </div>
          <details className="rounded-xl border border-border px-3 py-2" open={hasActiveMensurationFilters(filters)}>
            <summary className="cursor-pointer text-sm font-medium">Autres mensurations et code postal</summary>
            <div className="mt-3 flex flex-col gap-3">
              <Input name="code_postal" aria-label="Code postal" placeholder="Code postal" defaultValue={params.code_postal} />
              {MENSURATION_RANGE_FIELDS.filter((field) => field.key !== "taille").map((field) => (
                <div className="flex gap-2" key={field.key}>
                  <Input type="number" min={0} step="any" name={`${field.key}_min`} aria-label={`${field.label} minimum`} placeholder={`${field.label} min`} defaultValue={params[`${field.key}_min`]} />
                  <Input type="number" min={0} step="any" name={`${field.key}_max`} aria-label={`${field.label} maximum`} placeholder={`${field.label} max`} defaultValue={params[`${field.key}_max`]} />
                </div>
              ))}
              {MENSURATION_TEXT_FIELDS.map((field) => (
                <Input key={field.key} name={field.key} aria-label={field.label} placeholder={field.label} defaultValue={params[field.key]} />
              ))}
            </div>
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Rechercher</Button>
            <Link className="text-sm text-text-muted hover:text-text" href={`/figurants${isComediens ? "?profil=comediens" : ""}${!isTrombi ? (isComediens ? "&vue=liste" : "?vue=liste") : ""}`}>Réinitialiser</Link>
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
          criteresActifs={criteresActifs}
          canSelectAll={isOwner(profile)}
        />
      ) : (
      <>
      <div className="flex flex-col gap-3 md:hidden" aria-label="Liste des profils">
        {(figurants ?? []).map((f, i) => (
          <Card key={f.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/figurants/${f.id}`} className="min-w-0 break-words font-medium hover:text-coral">{nomComplet(f)}</Link>
              <PreviewButton items={previewItems} index={i} />
            </div>
            {f.cree_via_casting && <Badge tone="coral">Lien casting</Badge>}
            <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
              <dt className="text-text-muted">Âge</dt><dd>{computeAge(f.date_naissance) != null ? `${computeAge(f.date_naissance)} ans` : "—"}</dd>
              <dt className="text-text-muted">Taille</dt><dd>{f.taille_cm ? `${f.taille_cm} cm` : "—"}</dd>
              <dt className="text-text-muted">Poids</dt><dd>{f.poids_kg ? `${f.poids_kg} kg` : "—"}</dd>
              <dt className="text-text-muted">Ville</dt><dd className="break-words">{f.ville ?? "—"}</dd>
              <dt className="text-text-muted">Myrole</dt><dd>{f.compte_myrole ? "Oui" : "Non"}</dd>
              <dt className="text-text-muted">Contact</dt><dd className="min-w-0 break-all">{f.email ?? f.telephone ?? "—"}</dd>
            </dl>
            <ContactIcons telephone={f.telephone} email={f.email} variant="inline" />
            {f.tags.length > 0 && <div className="flex flex-wrap gap-1">{f.tags.map((t) => <Badge key={t} tone="yellow">{t}</Badge>)}</div>}
          </Card>
        ))}
        {(figurants ?? []).length === 0 && !error && <p className="py-10 text-center text-text-muted">{criteresActifs ? "Aucun profil ne correspond à ces critères." : "Aucun profil pour l'instant."}</p>}
      </div>
      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[740px] text-sm">
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
                    items={previewItems}
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
                  {criteresActifs ? "Aucun profil ne correspond à ces critères." : "Aucun profil pour l'instant."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      </>
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
