import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { setCurrentProjet } from "@/lib/projet-context";
import { cn } from "@/lib/cn";
import { CandidaturesTable, type Row, type CandidatureSummary } from "@/components/candidatures/candidatures-table";
import { SortChips } from "@/components/documents/sort-chips";
import { ONGLET_OUT_BE } from "@/lib/candidatures/types";
import { getOngletsForAnnonce, getTournagesConfirmesCount } from "@/lib/candidatures/onglets";
import { JoursTournageBar } from "@/components/candidatures/jours-tournage-bar";
import { GENRES } from "@/lib/figurants/types";
import { MensurationsFilterPanel } from "@/components/figurants/mensurations-filter-panel";
import {
  MENSURATION_RANGE_FIELDS,
  figurantMatchesMensurationFilters,
  type MensurationFilters,
} from "@/lib/figurants/mensuration-filters";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { groupByDimensions, parseDocSort, ageBracket, SORT_DIMENSIONS, type Dimension } from "@/lib/documents/sort";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import { getAnnonceQuestions } from "@/lib/annonces/questions";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { getProjetSignaturesOrOwnerNames } from "@/lib/projets/signature";
import type { MessageTemplate } from "@/lib/templates/types";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = {
  annonce_id?: string;
  onglet_id?: string;
  myrole?: string;
  genre?: string;
  vehicule?: string;
  age_min?: string;
  age_max?: string;
  question_id?: string;
  question_reponse?: string;
  dispo?: string | string[];
  jour?: string;
  ordre?: string;
  sort?: string | string[];
  page?: string;
} & MensurationFilters;

const CANDIDATURES_PAR_PAGE = 30;

const ORDRES = [
  { key: "recentes", label: "Plus récentes" },
  { key: "anciennes", label: "Plus anciennes" },
  { key: "age_asc", label: "Plus jeunes" },
  { key: "age_desc", label: "Plus âgé·es" },
  { key: "habitues", label: "Habitué·es d'abord" },
] as const;
type Ordre = (typeof ORDRES)[number]["key"];

function toList(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
}

// Les candidatures n'ont pas d'heure de convocation (ça n'existe qu'une fois
// bookées) — la puce "Heure de convocation" est donc exclue ci-dessous.
const CANDIDATURE_SORT_DIMENSIONS = SORT_DIMENSIONS.filter((d) => d.key !== "heure");

function candidatureDimLabel(c: CandidatureWithFilters, dim: Dimension): string {
  if (dim === "fonction") return c.fonction_assignee ?? "Sans fonction";
  if (dim === "cachet") return c.cachet_assigne ?? "Sans cachet";
  if (dim === "sexe") return c.figurants?.genre ?? "Non renseigné";
  if (dim === "age") return ageBracket(c.figurants?.date_naissance ?? null);
  return "";
}

function candidatureNameOf(c: CandidatureWithFilters) {
  return `${c.figurants?.prenom ?? ""} ${c.figurants?.nom ?? ""}`;
}

type CandidatureRaw = Omit<Row, "portraitUrl">;
type CandidatureWithFilters = CandidatureRaw & {
  message: string | null;
  created_at: string;
  onglet_id: string | null;
  figurants:
    | (CandidatureRaw["figurants"] & {
        genre: string | null;
        date_naissance: string | null;
        a_vehicule: boolean | null;
        vehicule_velo: boolean;
        vehicule_moto: boolean;
        vehicule_scooter: boolean;
        code_postal: string | null;
        taille_cm: number | null;
        poids_kg: number | null;
        pointure: number | null;
        tour_poitrine_cm: number | null;
        tour_taille_cm: number | null;
        tour_hanches_cm: number | null;
        tour_tete_cm: number | null;
        tour_cou_cm: number | null;
        jambes_ext_cm: number | null;
        jambes_int_cm: number | null;
        carrure_cm: number | null;
        veste: string | null;
        pantalon: string | null;
        gant: string | null;
      })
    | null;
};

export default async function CandidaturesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let annoncesQuery = supabase
    .from("annonces")
    .select("id, titre, statut, date_recherchee, lieu, projet_id, projets(nom, confidentiel, nom_code)")
    .order("created_at", { ascending: false });
  if (accessibleIds !== null) annoncesQuery = annoncesQuery.in("projet_id", idsOrNone(accessibleIds));

  const { data: annonces } = await annoncesQuery.returns<
    {
      id: string;
      titre: string;
      statut: string;
      date_recherchee: string | null;
      lieu: string | null;
      projet_id: string;
      projets: { nom: string; confidentiel: boolean; nom_code: string | null } | null;
    }[]
  >();

  const { data: allCandidatures } = await supabase.from("candidatures").select("annonce_id");
  const countByAnnonce = new Map<string, number>();
  for (const c of allCandidatures ?? []) {
    countByAnnonce.set(c.annonce_id, (countByAnnonce.get(c.annonce_id) ?? 0) + 1);
  }

  if (!params.annonce_id) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold"><FileText size={28} strokeWidth={1.75} />Candidatures</h1>
          <p className="mt-1 text-text-muted">Choisis une annonce pour voir les profils qui ont postulé.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {(annonces ?? []).map((a) => (
            <Link
              key={a.id}
              href={`/candidatures?annonce_id=${a.id}`}
              className="flex aspect-square w-52 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-ink px-3 text-center transition-colors hover:border-coral/60"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {projetNomPublic(a.projets)}
              </span>
              <span className="text-base font-semibold leading-tight">{a.titre}</span>
              <span className="text-xs text-text-muted">
                {a.date_recherchee ? formatDateShort(a.date_recherchee) : "Date libre"}
                {a.lieu ? ` · ${a.lieu}` : ""}
              </span>
              <div className="flex gap-1.5">
                <Badge tone={a.statut === "ouverte" ? "turquoise" : "default"}>{a.statut}</Badge>
                <Badge>{countByAnnonce.get(a.id) ?? 0} candidat·e{(countByAnnonce.get(a.id) ?? 0) > 1 ? "s" : ""}</Badge>
              </div>
            </Link>
          ))}
          {(annonces ?? []).length === 0 && (
            <p className="text-sm text-text-muted">Aucune annonce pour l&apos;instant.</p>
          )}
        </div>
      </div>
    );
  }

  const annonce = (annonces ?? []).find((a) => a.id === params.annonce_id);

  const query = supabase
    .from("candidatures")
    .select(
      "id, onglet_id, fonction_assignee, cachet_assigne, message, created_at, figurants(id, prenom, nom, ville, email, telephone, compte_myrole, genre, date_naissance, a_vehicule, vehicule_velo, vehicule_moto, vehicule_scooter, code_postal, taille_cm, poids_kg, pointure, tour_poitrine_cm, tour_taille_cm, tour_hanches_cm, tour_tete_cm, tour_cou_cm, jambes_ext_cm, jambes_int_cm, carrure_cm, veste, pantalon, gant), annonces(id, titre, projet_id, projets(nom, confidentiel, nom_code, lieu, signature))"
    )
    .eq("annonce_id", params.annonce_id)
    .order("created_at", { ascending: false });

  const [annonceQuestions, annonceDates] = await Promise.all([
    getAnnonceQuestions(params.annonce_id),
    getAnnonceDates(params.annonce_id),
  ]);

  const annonceDateIds = annonceDates.map((d) => d.id);
  // Ne garde que des dates de cette annonce : les ids viennent de l'URL.
  const dispoFilter = toList(params.dispo).filter((id) => annonceDateIds.includes(id));
  const ordre: Ordre = ORDRES.some((o) => o.key === params.ordre) ? (params.ordre as Ordre) : "recentes";
  const jourFilter = params.jour && annonceDateIds.includes(params.jour) ? params.jour : null;
  const annonceDatesIso = annonceDates.map((d) => d.date);

  const [
    { data: candidaturesRaw, error },
    { data: bookedCandidatures },
    { data: templates },
    { data: reponsesMatch },
    { data: disposOui },
    onglets,
    { data: joursRows },
    { data: bookingsJours },
    { data: journeesBesoins },
  ] = await Promise.all([
    query.returns<CandidatureWithFilters[]>(),
    supabase.from("bookings").select("candidature_id").not("candidature_id", "is", null),
    supabase.from("message_templates").select("*").order("nom").returns<MessageTemplate[]>(),
    params.question_id && params.question_reponse
      ? supabase
          .from("candidature_reponses")
          .select("candidature_id")
          .eq("annonce_question_id", params.question_id)
          .eq("reponse", params.question_reponse === "oui")
      : Promise.resolve({ data: null as { candidature_id: string }[] | null }),
    annonceDateIds.length > 0
      ? supabase
          .from("candidature_disponibilites")
          .select("candidature_id, annonce_date_id")
          .in("annonce_date_id", annonceDateIds)
          .eq("disponible", true)
      : Promise.resolve({ data: [] as { candidature_id: string; annonce_date_id: string }[] }),
    getOngletsForAnnonce(params.annonce_id),
    annonceDateIds.length > 0
      ? supabase.from("candidature_jours").select("candidature_id, annonce_date_id").in("annonce_date_id", annonceDateIds)
      : Promise.resolve({ data: [] as { candidature_id: string; annonce_date_id: string }[] }),
    annonce && annonceDatesIso.length > 0
      ? supabase.from("bookings").select("figurant_id, date").eq("projet_id", annonce.projet_id).in("date", annonceDatesIso)
      : Promise.resolve({ data: [] as { figurant_id: string; date: string }[] }),
    annonce && annonceDatesIso.length > 0
      ? supabase
          .from("journees")
          .select("date, journee_besoins(quantite)")
          .eq("projet_id", annonce.projet_id)
          .in("date", annonceDatesIso)
          .returns<{ date: string; journee_besoins: { quantite: number }[] }[]>()
      : Promise.resolve({ data: [] as { date: string; journee_besoins: { quantite: number }[] }[] }),
  ]);

  // Jours de tournage prévus par candidature, et personnes déjà présentes
  // dans la journée correspondante (booking sur ce projet à cette date).
  const dateIsoById = new Map(annonceDates.map((d) => [d.id, d.date]));
  const joursPrevus = new Map<string, Set<string>>();
  for (const j of joursRows ?? []) {
    const set = joursPrevus.get(j.candidature_id) ?? new Set<string>();
    set.add(j.annonce_date_id);
    joursPrevus.set(j.candidature_id, set);
  }
  const dansLaJournee = new Set((bookingsJours ?? []).map((b) => `${b.figurant_id}|${b.date}`));
  // Une journée sans besoin saisi (créée par un premier envoi) n'affiche
  // pas de "/ 0".
  const besoinsByDate = new Map(
    (journeesBesoins ?? [])
      .map((j) => [j.date, j.journee_besoins.reduce((sum, b) => sum + b.quantite, 0)] as const)
      .filter(([, total]) => total > 0)
  );
  const figurantIdByCandidature = new Map((candidaturesRaw ?? []).map((c) => [c.id, c.figurants?.id ?? null]));
  const estTransfere = (candidatureId: string, dateId: string) =>
    dansLaJournee.has(`${figurantIdByCandidature.get(candidatureId)}|${dateIsoById.get(dateId)}`);

  const datesDispoByCandidature = new Map<string, Set<string>>();
  for (const d of disposOui ?? []) {
    const set = datesDispoByCandidature.get(d.candidature_id) ?? new Set<string>();
    set.add(d.annonce_date_id);
    datesDispoByCandidature.set(d.candidature_id, set);
  }

  const bookedCandidatureIds = new Set((bookedCandidatures ?? []).map((b) => b.candidature_id));
  // Règle de Loïc : une fois envoyée dans un booking, une candidature ne
  // réapparaît plus jamais dans cette annonce, même s'il lui reste des jours
  // prévus (ils restent comptés et envoyables depuis la barre "Jours de
  // tournage"). Postuler à une autre annonce crée une nouvelle candidature.
  const estMasquee = (c: CandidatureWithFilters) => bookedCandidatureIds.has(c.id);

  let candidatures = (candidaturesRaw ?? []).filter((c) => !estMasquee(c));
  if (params.myrole === "oui") {
    candidatures = candidatures.filter((c) => c.figurants?.compte_myrole);
  } else if (params.myrole === "non") {
    candidatures = candidatures.filter((c) => !c.figurants?.compte_myrole);
  }
  if (params.genre) {
    candidatures = candidatures.filter((c) => c.figurants?.genre === params.genre);
  }
  if (params.vehicule === "oui") {
    candidatures = candidatures.filter((c) => c.figurants?.a_vehicule);
  } else if (params.vehicule === "non") {
    candidatures = candidatures.filter((c) => c.figurants?.a_vehicule === false);
  } else if (params.vehicule === "velo") {
    candidatures = candidatures.filter((c) => c.figurants?.vehicule_velo);
  } else if (params.vehicule === "moto") {
    candidatures = candidatures.filter((c) => c.figurants?.vehicule_moto);
  } else if (params.vehicule === "scooter") {
    candidatures = candidatures.filter((c) => c.figurants?.vehicule_scooter);
  }
  const ageMin = params.age_min ? Number(params.age_min) : null;
  const ageMax = params.age_max ? Number(params.age_max) : null;
  if (ageMin !== null || ageMax !== null) {
    candidatures = candidatures.filter((c) => {
      const age = computeAge(c.figurants?.date_naissance ?? null);
      if (age === null) return false;
      if (ageMin !== null && age < ageMin) return false;
      if (ageMax !== null && age > ageMax) return false;
      return true;
    });
  }
  candidatures = candidatures.filter((c) => figurantMatchesMensurationFilters(c.figurants, params));
  if (reponsesMatch) {
    const matchingIds = new Set(reponsesMatch.map((r) => r.candidature_id));
    candidatures = candidatures.filter((c) => matchingIds.has(c.id));
  }
  // Compteur par date sur le périmètre de l'onglet affiché, mais avant le
  // filtre de dates lui-même : chaque pastille annonce combien de personnes
  // sont dispo ce jour-là.
  const dispoCountByDate = new Map<string, number>();
  for (const c of candidatures) {
    if (params.onglet_id === "a_trier" && c.onglet_id !== null) continue;
    if (params.onglet_id && params.onglet_id !== "a_trier" && c.onglet_id !== params.onglet_id) continue;
    for (const dateId of datesDispoByCandidature.get(c.id) ?? []) {
      dispoCountByDate.set(dateId, (dispoCountByDate.get(dateId) ?? 0) + 1);
    }
  }
  if (dispoFilter.length > 0) {
    candidatures = candidatures.filter((c) => {
      const dispos = datesDispoByCandidature.get(c.id);
      return dispoFilter.every((id) => dispos?.has(id));
    });
  }
  if (jourFilter) {
    candidatures = candidatures.filter((c) => joursPrevus.get(c.id)?.has(jourFilter));
  }

  // Par jour : toutes les personnes prévues (quel que soit le filtre
  // affiché), dont celles déjà dans la journée, et le besoin saisi dans
  // Bookings pour cette journée s'il existe.
  const joursTournage = annonceDates.map((d) => {
    const prevues = (joursRows ?? []).filter((j) => j.annonce_date_id === d.id);
    return {
      id: d.id,
      date: d.date,
      prevues: prevues.length,
      dansLaJournee: prevues.filter((j) => estTransfere(j.candidature_id, d.id)).length,
      besoin: besoinsByDate.get(d.date) ?? null,
    };
  });

  // Compte par onglet pour la barre d'onglets — calculé sur le même
  // périmètre que les filtres actifs (myrole/genre/âge/question), mais
  // avant le découpage par onglet lui-même, pour que chaque pastille
  // annonce le nombre qu'on obtiendra en cliquant dessus.
  const tabCounts: Record<string, number> = {
    tous: candidatures.length,
    a_trier: candidatures.filter((c) => c.onglet_id === null).length,
  };
  for (const o of onglets ?? []) {
    tabCounts[o.id] = candidatures.filter((c) => c.onglet_id === o.id).length;
  }

  if (params.onglet_id === "a_trier") {
    candidatures = candidatures.filter((c) => c.onglet_id === null);
  } else if (params.onglet_id) {
    candidatures = candidatures.filter((c) => c.onglet_id === params.onglet_id);
  }

  const tournagesTous =
    ordre === "habitues"
      ? await getTournagesConfirmesCount(
          candidatures.map((c) => c.figurants?.id).filter((id): id is string => !!id)
        )
      : null;
  const ageOf = (c: CandidatureWithFilters) => computeAge(c.figurants?.date_naissance ?? null);
  const tournagesOf = (c: CandidatureWithFilters) => (c.figurants ? (tournagesTous?.get(c.figurants.id) ?? 0) : 0);
  const recentFirst = (a: CandidatureWithFilters, b: CandidatureWithFilters) => b.created_at.localeCompare(a.created_at);
  // Âge inconnu toujours en fin de liste, dans les deux sens.
  const compareOrdre = (a: CandidatureWithFilters, b: CandidatureWithFilters): number => {
    if (ordre === "anciennes") return a.created_at.localeCompare(b.created_at);
    if (ordre === "age_asc" || ordre === "age_desc") {
      const ageA = ageOf(a);
      const ageB = ageOf(b);
      if (ageA === null || ageB === null) return (ageA === null ? 1 : 0) - (ageB === null ? 1 : 0);
      return ordre === "age_asc" ? ageA - ageB : ageB - ageA;
    }
    if (ordre === "habitues") return tournagesOf(b) - tournagesOf(a) || recentFirst(a, b);
    return recentFirst(a, b);
  };
  candidatures = [...candidatures].sort(compareOrdre);

  const docSort = parseDocSort(params.sort);
  const sortGroups = groupByDimensions(candidatures, docSort, candidatureDimLabel, candidatureNameOf, compareOrdre);
  if (sortGroups) candidatures = sortGroups.flatMap((g) => g.items);

  // Pagination — appliquée AVANT les lookups coûteux ci-dessous (photos,
  // réponses, dispos) pour ne jamais générer d'URL signées ou de requêtes
  // pour des centaines/milliers de candidatures qui ne seront pas
  // affichées sur cette page. `candidatures` (non tronqué) reste
  // disponible pour les compteurs d'onglets/genre au-dessus.
  const totalPages = Math.max(1, Math.ceil(candidatures.length / CANDIDATURES_PAR_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number(params.page) || 1));
  const pageCandidatures = candidatures.slice((page - 1) * CANDIDATURES_PAR_PAGE, page * CANDIDATURES_PAR_PAGE);

  const portraitByFigurant = await getPhotosByFigurantId(
    pageCandidatures.map((c) => c.figurants?.id).filter((id): id is string => !!id)
  );

  const candidatureIds = pageCandidatures.map((c) => c.id);
  const [{ data: reponsesRaw }, tournagesPage] = await Promise.all([
    candidatureIds.length > 0
      ? supabase
          .from("candidature_reponses")
          .select("candidature_id, reponse, annonce_questions(label)")
          .in("candidature_id", candidatureIds)
          .returns<{ candidature_id: string; reponse: boolean; annonce_questions: { label: string } | null }[]>()
      : Promise.resolve({ data: [] as { candidature_id: string; reponse: boolean; annonce_questions: { label: string } | null }[] }),
    tournagesTous ??
      getTournagesConfirmesCount(pageCandidatures.map((c) => c.figurants?.id).filter((id): id is string => !!id)),
  ]);

  const summaries: Record<string, CandidatureSummary> = {};
  for (const c of pageCandidatures) {
    summaries[c.id] = {
      questions: [],
      message: c.message,
      age: ageOf(c),
      tournages: c.figurants ? (tournagesPage.get(c.figurants.id) ?? 0) : 0,
      jours: annonceDates.map((d) => ({
        id: d.id,
        date: d.date,
        disponible: datesDispoByCandidature.get(c.id)?.has(d.id) ?? false,
        prevu: joursPrevus.get(c.id)?.has(d.id) ?? false,
        dansLaJournee: estTransfere(c.id, d.id),
      })),
    };
  }
  for (const r of reponsesRaw ?? []) {
    const entry = summaries[r.candidature_id];
    if (!r.annonce_questions || !entry) continue;
    entry.questions.push({ label: r.annonce_questions.label, reponse: r.reponse });
  }

  const signatureByProjet = await getProjetSignaturesOrOwnerNames(
    supabase,
    pageCandidatures.map((c) => c.annonces?.projet_id).filter((id): id is string => !!id)
  );
  const pagedRows: Row[] = pageCandidatures.map((c) => ({
    ...c,
    // La signature calibrée sur le projet prime ; sans elle, le nom de la
    // cheffe propriétaire — jamais une formule générique.
    annonces: c.annonces
      ? {
          ...c.annonces,
          projets: c.annonces.projets
            ? {
                ...c.annonces.projets,
                signature: c.annonces.projets.signature || signatureByProjet.get(c.annonces.projet_id) || "",
              }
            : c.annonces.projets,
        }
      : c.annonces,
    portraitUrl: c.figurants ? pickPortrait(portraitByFigurant.get(c.figurants.id))?.url ?? null : null,
    photos: c.figurants ? (portraitByFigurant.get(c.figurants.id) ?? []) : [],
  }));

  // Partagée par pageHref/tabHref/genreTabHref ci-dessous : les trois ne
  // diffèrent que par onglet_id/genre/page (explicites, jamais hérités de
  // `params` par défaut — cf. tabHref qui doit pouvoir vider l'onglet), le
  // reste des filtres (myrole, véhicule, âge, code postal, mensurations,
  // question, tri) est toujours repris tel quel depuis `params`.
  function buildCandidaturesHref(
    base: SearchParams,
    docSortDims: Dimension[],
    {
      ongletId,
      genre,
      page: pageOverride,
      dispo = dispoFilter,
      ordre: ordreOverride = ordre,
      jour = jourFilter,
    }: { ongletId?: string; genre?: string; page?: number; dispo?: string[]; ordre?: Ordre; jour?: string | null }
  ) {
    const sp = new URLSearchParams();
    sp.set("annonce_id", base.annonce_id!);
    if (ongletId) sp.set("onglet_id", ongletId);
    if (base.myrole) sp.set("myrole", base.myrole);
    if (genre) sp.set("genre", genre);
    if (base.vehicule) sp.set("vehicule", base.vehicule);
    if (base.age_min) sp.set("age_min", base.age_min);
    if (base.age_max) sp.set("age_max", base.age_max);
    if (base.code_postal) sp.set("code_postal", base.code_postal);
    if (base.veste) sp.set("veste", base.veste);
    if (base.pantalon) sp.set("pantalon", base.pantalon);
    if (base.gant) sp.set("gant", base.gant);
    for (const f of MENSURATION_RANGE_FIELDS) {
      const min = base[`${f.key}_min`];
      if (min) sp.set(`${f.key}_min`, min);
      const max = base[`${f.key}_max`];
      if (max) sp.set(`${f.key}_max`, max);
    }
    if (base.question_id) sp.set("question_id", base.question_id);
    if (base.question_reponse) sp.set("question_reponse", base.question_reponse);
    for (const id of dispo) sp.append("dispo", id);
    if (jour) sp.set("jour", jour);
    if (ordreOverride !== "recentes") sp.set("ordre", ordreOverride);
    for (const dim of docSortDims) sp.append("sort", dim);
    if (pageOverride && pageOverride > 1) sp.set("page", String(pageOverride));
    return `/candidatures?${sp.toString()}`;
  }

  const pageHref = (p: number) =>
    buildCandidaturesHref(params, docSort, { ongletId: params.onglet_id, genre: params.genre, page: p });

  const projetOption = annonce ? [{ id: annonce.projet_id, nom: annonce.projets?.nom ?? "" }] : [];

  const tabHref = (ongletParam?: string) =>
    buildCandidaturesHref(params, docSort, { ongletId: ongletParam, genre: params.genre });

  const tabs = [
    { key: "tous", label: "Tous", href: tabHref(), count: tabCounts.tous, danger: false },
    { key: "a_trier", label: "À trier", href: tabHref("a_trier"), count: tabCounts.a_trier, danger: false },
    ...(onglets ?? []).map((o) => ({
      key: o.id,
      label: o.nom,
      href: tabHref(o.id),
      count: tabCounts[o.id] ?? 0,
      danger: o.nom === ONGLET_OUT_BE,
    })),
  ];

  // Compteurs par genre calculés sur le périmètre déjà filtré (onglet,
  // myrole, véhicule...) — mais AVANT le filtre genre lui-même, pour que
  // les pastilles montrent la répartition réelle et pas juste 0 partout
  // une fois un genre sélectionné.
  const genreTabHref = (genreParam?: string) =>
    buildCandidaturesHref(params, docSort, { ongletId: params.onglet_id, genre: genreParam });

  const toggleDispoHref = (dateId: string) =>
    buildCandidaturesHref(params, docSort, {
      ongletId: params.onglet_id,
      genre: params.genre,
      dispo: dispoFilter.includes(dateId) ? dispoFilter.filter((id) => id !== dateId) : [...dispoFilter, dateId],
    });
  const jourHref = (dateId: string | null) =>
    buildCandidaturesHref(params, docSort, { ongletId: params.onglet_id, genre: params.genre, jour: dateId });
  const ordreHref = (o: Ordre) =>
    buildCandidaturesHref(params, docSort, { ongletId: params.onglet_id, genre: params.genre, ordre: o });

  const candidaturesAvantGenre = (candidaturesRaw ?? [])
    .filter((c) => !estMasquee(c))
    .filter((c) => (params.myrole === "oui" ? c.figurants?.compte_myrole : true))
    .filter((c) => (params.myrole === "non" ? !c.figurants?.compte_myrole : true))
    .filter((c) => (params.onglet_id === "a_trier" ? c.onglet_id === null : true))
    .filter((c) => (params.onglet_id && params.onglet_id !== "a_trier" ? c.onglet_id === params.onglet_id : true));
  const genreTabs = [
    { key: "", label: "Tous", href: genreTabHref(), count: candidaturesAvantGenre.length },
    ...GENRES.map((g) => ({
      key: g,
      label: g,
      href: genreTabHref(g),
      count: candidaturesAvantGenre.filter((c) => c.figurants?.genre === g).length,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          <Link href="/candidatures" className="hover:text-text">
            ← Candidatures
          </Link>
          <Link href="/candidatures" className="ml-3 text-coral hover:underline">
            Changer d&apos;annonce
          </Link>
        </p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{annonce?.titre ?? "Annonce"}</h1>
            <p className="mt-1 text-text-muted">
              {projetNomPublic(annonce?.projets)}
              {annonce?.lieu ? ` · ${annonce.lieu}` : ""} · {candidatures.length} candidature
              {candidatures.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {annonce?.projet_id && (
              <form action={setCurrentProjet.bind(null, annonce.projet_id, "/bookings")}>
                <Button type="submit" variant="secondary">
                  📋 Bookings
                </Button>
              </form>
            )}
            {isOwner(profile) && (
              <ButtonLink
                href={`/candidatures/export?${new URLSearchParams(
                  Object.entries({
                    annonce_id: params.annonce_id,
                    myrole: params.myrole,
                    genre: params.genre,
                    vehicule: params.vehicule,
                  }).filter(([, v]) => v) as [string, string][]
                ).toString()}`}
                variant="secondary"
              >
                Exporter Excel
              </ButtonLink>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const active = tab.key === "tous" ? !params.onglet_id : params.onglet_id === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? tab.danger
                    ? "border-danger bg-danger/15 text-danger"
                    : "border-coral bg-coral/15 text-coral"
                  : "border-border text-text-muted hover:text-text"
              )}
            >
              {tab.label} ({tab.count})
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Genre :</span>
        {genreTabs.map((tab) => {
          const active = tab.key === "" ? !params.genre : params.genre === tab.key;
          return (
            <Link
              key={tab.key || "tous"}
              href={tab.href}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "border-turquoise bg-turquoise/15 text-turquoise" : "border-border text-text-muted hover:text-text"
              )}
            >
              {tab.label} ({tab.count})
            </Link>
          );
        })}
      </div>

      {annonceDates.length > 0 && annonce && (
        <JoursTournageBar
          jours={joursTournage}
          activeId={jourFilter}
          hrefs={Object.fromEntries(annonceDates.map((d) => [d.id, jourHref(d.id)]))}
          clearHref={jourHref(null)}
          projetId={annonce.projet_id}
        />
      )}

      {annonceDates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Dispo le :</span>
          {annonceDates.map((d) => {
            const active = dispoFilter.includes(d.id);
            return (
              <Link
                key={d.id}
                href={toggleDispoHref(d.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "border-turquoise bg-turquoise/15 text-turquoise" : "border-border text-text-muted hover:text-text"
                )}
              >
                {formatDateShort(d.date)} ({dispoCountByDate.get(d.id) ?? 0})
              </Link>
            );
          })}
          {dispoFilter.length > 1 && (
            <span className="text-xs text-text-muted">dispo sur toutes les dates cochées</span>
          )}
        </div>
      )}

      <SortChips
        baseParams={{
          annonce_id: params.annonce_id,
          onglet_id: params.onglet_id,
          myrole: params.myrole,
          genre: params.genre,
          vehicule: params.vehicule,
          age_min: params.age_min,
          age_max: params.age_max,
          code_postal: params.code_postal,
          veste: params.veste,
          pantalon: params.pantalon,
          gant: params.gant,
          ...Object.fromEntries(
            MENSURATION_RANGE_FIELDS.flatMap((f) => [
              [`${f.key}_min`, params[`${f.key}_min`]],
              [`${f.key}_max`, params[`${f.key}_max`]],
            ])
          ),
          question_id: params.question_id,
          question_reponse: params.question_reponse,
          dispo: dispoFilter,
          jour: jourFilter ?? undefined,
          ordre: ordre === "recentes" ? undefined : ordre,
        }}
        current={docSort}
        dimensions={CANDIDATURE_SORT_DIMENSIONS}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Ordre :</span>
        {ORDRES.map((o) => (
          <Link
            key={o.key}
            href={ordreHref(o.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              ordre === o.key ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
            )}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <Card>
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4" method="get">
          <input type="hidden" name="annonce_id" value={params.annonce_id} />
          {params.onglet_id && <input type="hidden" name="onglet_id" value={params.onglet_id} />}
          {docSort.map((dim) => (
            <input key={dim} type="hidden" name="sort" value={dim} />
          ))}
          {dispoFilter.map((id) => (
            <input key={id} type="hidden" name="dispo" value={id} />
          ))}
          {ordre !== "recentes" && <input type="hidden" name="ordre" value={ordre} />}
          {jourFilter && <input type="hidden" name="jour" value={jourFilter} />}
          <Select name="myrole" defaultValue={params.myrole ?? ""}>
            <option value="">Myrole (tous)</option>
            <option value="oui">Avec compte Myrole</option>
            <option value="non">Sans compte Myrole</option>
          </Select>
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
          <div className="flex gap-2">
            <Input
              type="number"
              name="age_min"
              placeholder="Âge min"
              defaultValue={params.age_min ?? ""}
              min={0}
            />
            <Input
              type="number"
              name="age_max"
              placeholder="Âge max"
              defaultValue={params.age_max ?? ""}
              min={0}
            />
          </div>
          <MensurationsFilterPanel defaultValues={params} />
          {annonceQuestions.length > 0 && (
            <>
              <Select name="question_id" defaultValue={params.question_id ?? ""}>
                <option value="">Question (toutes)</option>
                {annonceQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </Select>
              <Select name="question_reponse" defaultValue={params.question_reponse ?? ""}>
                <option value="">Réponse (toutes)</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </Select>
            </>
          )}
          <button
            type="submit"
            className="col-span-2 rounded-full bg-ink-raised-2 px-5 py-2.5 text-sm font-medium hover:border hover:border-coral/60 md:col-span-1"
          >
            Filtrer
          </button>
          <Link
            href={`/candidatures?annonce_id=${params.annonce_id}`}
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

      <CandidaturesTable
        rows={pagedRows}
        templates={templates ?? []}
        projets={projetOption}
        summaries={summaries}
        onglets={onglets}
        annonceId={params.annonce_id}
        triIds={candidatures.map((c) => c.id)}
      />

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
