import { comparerNoms, nomComplet, trierParNom } from "@/lib/noms";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Button, ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { setCurrentProjet } from "@/lib/projet-context";
import { cn } from "@/lib/cn";
import { CandidaturesTable, type Row, type CandidatureSummary } from "@/components/candidatures/candidatures-table";
import { FiltresCandidatures } from "@/components/candidatures/filtres-candidatures";
import { AGES, ORDRES, type Ordre } from "@/lib/candidatures/filtres";
import { NouvelOnglet } from "@/components/candidatures/nouvel-onglet";
import type { JourPanneau } from "@/components/candidatures/jours-panneau";
import { getModelesEquipe } from "@/lib/templates/equipe";
import { getLiensAnnonce, dernierVoteParCandidature } from "@/lib/validation/data";
import { getSiteOrigin } from "@/lib/partage/data";
import { getOngletsForAnnonce, getTournagesConfirmesCount } from "@/lib/candidatures/onglets";
import { emojiOnglet, sansAccent } from "@/lib/candidatures/onglets-affichage";
import type { BookingStatut } from "@/lib/bookings/types";
import { GENRES } from "@/lib/figurants/types";
import { MensurationsFilterPanel } from "@/components/figurants/mensurations-filter-panel";
import {
  MENSURATION_RANGE_FIELDS,
  MENSURATION_TEXT_FIELDS,
  figurantMatchesMensurationFilters,
  type MensurationFilters,
} from "@/lib/figurants/mensuration-filters";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { getPhotosByFigurantId, getPhotosParCandidature, pickPortrait } from "@/lib/documents/data";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { computeAge } from "@/lib/documents/fields";
import { formatDateShort, formatDayMonth } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import { getAnnonceQuestions } from "@/lib/annonces/questions";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { getProjetSignaturesOrOwnerNames } from "@/lib/projets/signature";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = {
  annonce_id?: string;
  onglet_id?: string;
  q?: string;
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
  vue?: string;
  liens?: string;
  jour_vu?: string;
  page?: string;
} & MensurationFilters;

const CANDIDATURES_PAR_PAGE = 30;

const GENRE_LABELS: Record<string, string> = { Femme: "Femmes", Homme: "Hommes", "Non-binaire": "Non-binaires" };

const VEHICULES: Record<string, string> = {
  oui: "A un véhicule",
  non: "Sans véhicule",
  voiture: "Voiture",
  velo: "Vélo",
  moto: "Moto",
  scooter: "Scooter",
};

// Statuts qui ne comptent pas comme une place prise dans la journée.
const HORS_JOURNEE: BookingStatut[] = ["annulé", "indisponible"];

function toList(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
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
        vehicule_voiture: boolean;
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

type BookingJour = {
  id: string;
  figurant_id: string;
  date: string;
  statut: BookingStatut;
  fonction: string | null;
  figurants: { prenom: string; nom: string } | null;
};

// Recherche par prénom, nom ou email, sans tenir compte des accents.
function correspondRecherche(f: { prenom: string; nom: string; email: string | null } | null, q: string) {
  if (!f || !q) return !q;
  const cible = sansAccent(`${f.prenom} ${f.nom} ${f.nom} ${f.prenom} ${f.email ?? ""}`);
  return cible.includes(sansAccent(q));
}

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

  const annonceId = params.annonce_id;
  const annonce = (annonces ?? []).find((a) => a.id === annonceId);
  const recherche = (params.q ?? "").trim().slice(0, 80);

  // Toutes les lignes, par paquets de 1000 (voir fetchAll).
  const query = (from: number, to: number) => supabase
    .from("candidatures")
    .select(
      "id, onglet_id, fonction_assignee, cachet_assigne, message, created_at, figurants(id, prenom, nom, ville, email, telephone, compte_myrole, genre, date_naissance, a_vehicule, vehicule_voiture, vehicule_velo, vehicule_moto, vehicule_scooter, code_postal, taille_cm, poids_kg, pointure, tour_poitrine_cm, tour_taille_cm, tour_hanches_cm, tour_tete_cm, tour_cou_cm, jambes_ext_cm, jambes_int_cm, carrure_cm, veste, pantalon, gant), annonces(id, titre, projet_id, projets(nom, confidentiel, nom_code, lieu, signature))"
    )
    .eq("annonce_id", annonceId)
    // Règle de Loïc : une fois envoyée en booking, une candidature ne
    // réapparaît plus jamais dans cette annonce, même s'il lui reste des
    // jours prévus (ils restent comptés et envoyables depuis le panneau
    // "Jours de tournage") ou si le booking est supprimé / déplacé. Marque
    // posée par la base (voir migration 20261007000004). Postuler à une
    // autre annonce crée une nouvelle candidature.
    .is("envoyee_en_booking_le", null)
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to)
    .returns<CandidatureWithFilters[]>();

  const [annonceQuestions, annonceDates, templates, liensValidation, origin] = await Promise.all([
    getAnnonceQuestions(annonceId),
    getAnnonceDates(annonceId),
    getModelesEquipe(),
    getLiensAnnonce(annonceId),
    getSiteOrigin(),
  ]);
  // Dernier avis de la MES par profil (tous liens de l'annonce confondus).
  const avisMes = dernierVoteParCandidature(liensValidation.votes);

  const annonceDateIds = annonceDates.map((d) => d.id);
  // Ne garde que des dates de cette annonce : les ids viennent de l'URL.
  const dispoFilter = toList(params.dispo).filter((id) => annonceDateIds.includes(id));
  const ordre: Ordre = ORDRES.some((o) => o.key === params.ordre) ? (params.ordre as Ordre) : "recentes";
  const jourFilter = params.jour && annonceDateIds.includes(params.jour) ? params.jour : null;
  const vue = params.vue === "liste" ? "liste" : "trombi";
  const annonceDatesIso = annonceDates.map((d) => d.date);

  const [
    { data: candidaturesRaw, error },
    { data: reponsesMatch },
    { data: disposOui },
    onglets,
    { data: joursRows },
    { data: bookingsJours },
    { data: journeesBesoins },
    { data: dejaEnvoyees },
  ] = await Promise.all([
    fetchAll(query),
    params.question_id && params.question_reponse
      ? fetchAll((from, to) =>
          supabase
            .from("candidature_reponses")
            .select("candidature_id")
            .eq("annonce_question_id", params.question_id!)
            .eq("reponse", params.question_reponse === "oui")
            .order("candidature_id")
            .range(from, to)
        )
      : Promise.resolve({ data: null as { candidature_id: string }[] | null }),
    annonceDateIds.length > 0
      ? fetchAll((from, to) =>
          supabase
            .from("candidature_disponibilites")
            .select("candidature_id, annonce_date_id")
            .in("annonce_date_id", annonceDateIds)
            .eq("disponible", true)
            .order("id")
            .range(from, to)
        )
      : Promise.resolve({ data: [] as { candidature_id: string; annonce_date_id: string }[] }),
    getOngletsForAnnonce(annonceId),
    annonceDateIds.length > 0
      ? fetchAll((from, to) =>
          supabase
            .from("candidature_jours")
            .select("candidature_id, annonce_date_id, candidatures(figurant_id)")
            .in("annonce_date_id", annonceDateIds)
            .order("candidature_id")
            .order("annonce_date_id")
            .range(from, to)
            .returns<{ candidature_id: string; annonce_date_id: string; candidatures: { figurant_id: string } | null }[]>()
        )
      : Promise.resolve({
          data: [] as { candidature_id: string; annonce_date_id: string; candidatures: { figurant_id: string } | null }[],
        }),
    annonce && annonceDatesIso.length > 0
      ? fetchAll((from, to) =>
          supabase
            .from("bookings")
            .select("id, figurant_id, date, statut, fonction, figurants!bookings_figurant_id_fkey(prenom, nom)")
            .eq("projet_id", annonce.projet_id)
            .in("date", annonceDatesIso)
            .order("id")
            .range(from, to)
            .returns<BookingJour[]>()
        )
      : Promise.resolve({ data: [] as BookingJour[] }),
    annonce && annonceDatesIso.length > 0
      ? supabase
          .from("journees")
          .select("date, journee_besoins(fonction, quantite)")
          .eq("projet_id", annonce.projet_id)
          .in("date", annonceDatesIso)
          .returns<{ date: string; journee_besoins: { fonction: string; quantite: number }[] }[]>()
      : Promise.resolve({ data: [] as { date: string; journee_besoins: { fonction: string; quantite: number }[] }[] }),
    // Recherche : signale aussi les personnes déjà envoyées en booking
    // (elles ne sont plus dans la liste).
    recherche
      ? fetchAll((from, to) =>
          supabase
            .from("candidatures")
            .select("id, figurants(prenom, nom, email)")
            .eq("annonce_id", annonceId)
            .not("envoyee_en_booking_le", "is", null)
            .order("id")
            .range(from, to)
            .returns<{ id: string; figurants: { prenom: string; nom: string; email: string | null } | null }[]>()
        )
      : Promise.resolve({ data: [] as { id: string; figurants: { prenom: string; nom: string; email: string | null } | null }[] }),
  ]);

  // Jours prévus par candidature, et personnes déjà dans la journée
  // correspondante (booking sur ce projet à cette date).
  const dateIsoById = new Map(annonceDates.map((d) => [d.id, d.date]));
  const joursPrevus = new Map<string, Set<string>>();
  for (const j of joursRows ?? []) {
    const set = joursPrevus.get(j.candidature_id) ?? new Set<string>();
    set.add(j.annonce_date_id);
    joursPrevus.set(j.candidature_id, set);
  }
  const dansLaJournee = new Set((bookingsJours ?? []).map((b) => `${b.figurant_id}|${b.date}`));
  const estTransfere = (figurantId: string | null | undefined, dateId: string) =>
    !!figurantId && dansLaJournee.has(`${figurantId}|${dateIsoById.get(dateId)}`);

  const datesDispoByCandidature = new Map<string, Set<string>>();
  for (const d of disposOui ?? []) {
    const set = datesDispoByCandidature.get(d.candidature_id) ?? new Set<string>();
    set.add(d.annonce_date_id);
    datesDispoByCandidature.set(d.candidature_id, set);
  }

  // Onglet affiché : « À trier » par défaut, « tous », ou un onglet de
  // l'annonce. OUT (fixe) : ses candidatures n'apparaissent que là.
  const ongletOutId = onglets.find((o) => o.fixe)?.id ?? null;
  const onglet =
    params.onglet_id === "tous" || params.onglet_id === "mes" || onglets.some((o) => o.id === params.onglet_id)
      ? params.onglet_id!
      : "a_trier";
  // « Validés MES » : profils dont le dernier avis sur un lien de
  // validation est « Valider », quel que soit leur onglet de rangement.
  const dansOnglet = (c: CandidatureWithFilters, o: string) =>
    o === "a_trier"
      ? c.onglet_id === null
      : o === "tous"
        ? c.onglet_id !== ongletOutId
        : o === "mes"
          ? avisMes.get(c.id)?.vote === "oui"
          : c.onglet_id === o;

  // Filtres d'attributs (tout sauf onglet et dispo).
  let candidatures = candidaturesRaw ?? [];
  if (params.myrole === "oui") candidatures = candidatures.filter((c) => c.figurants?.compte_myrole);
  else if (params.myrole === "non") candidatures = candidatures.filter((c) => !c.figurants?.compte_myrole);
  if (params.genre) candidatures = candidatures.filter((c) => c.figurants?.genre === params.genre);
  if (params.vehicule === "oui") candidatures = candidatures.filter((c) => c.figurants?.a_vehicule);
  else if (params.vehicule === "non") candidatures = candidatures.filter((c) => c.figurants?.a_vehicule === false);
  else if (params.vehicule === "voiture") candidatures = candidatures.filter((c) => c.figurants?.vehicule_voiture);
  else if (params.vehicule === "velo") candidatures = candidatures.filter((c) => c.figurants?.vehicule_velo);
  else if (params.vehicule === "moto") candidatures = candidatures.filter((c) => c.figurants?.vehicule_moto);
  else if (params.vehicule === "scooter") candidatures = candidatures.filter((c) => c.figurants?.vehicule_scooter);
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
  if (recherche) candidatures = candidatures.filter((c) => correspondRecherche(c.figurants, recherche));

  // Nombre de dispo par date dans l'onglet affiché (menu « Dispo le »).
  const dispoCountByDate = new Map<string, number>();
  for (const c of candidatures) {
    if (!dansOnglet(c, onglet)) continue;
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
  if (jourFilter) candidatures = candidatures.filter((c) => joursPrevus.get(c.id)?.has(jourFilter));

  // Compte par onglet avec les mêmes filtres : chaque onglet annonce le
  // nombre qu'on obtiendra en cliquant dessus.
  const tabCounts: Record<string, number> = {
    a_trier: candidatures.filter((c) => dansOnglet(c, "a_trier")).length,
    tous: candidatures.filter((c) => dansOnglet(c, "tous")).length,
    mes: candidatures.filter((c) => dansOnglet(c, "mes")).length,
  };
  for (const o of onglets) tabCounts[o.id] = candidatures.filter((c) => c.onglet_id === o.id).length;

  candidatures = candidatures.filter((c) => dansOnglet(c, onglet));

  // Recherche : les personnes trouvées dans un autre onglet, pour ne pas les
  // croire absentes.
  const nomOnglet = (id: string | null) => {
    if (id === null) return "📥 À trier";
    const o = onglets.find((x) => x.id === id);
    return o ? `${emojiOnglet(o)} ${o.nom}` : "autre onglet";
  };
  const ailleurs = recherche
    ? (candidaturesRaw ?? [])
        .filter((c) => correspondRecherche(c.figurants, recherche) && !dansOnglet(c, onglet))
        .slice(0, 12)
        .map((c) => ({
          id: c.id,
          nom: nomComplet(c.figurants),
          onglet: nomOnglet(c.onglet_id),
          href: `/candidatures?${new URLSearchParams({ annonce_id: annonceId, onglet_id: c.onglet_id ?? "a_trier", q: recherche })}`,
        }))
    : [];
  const envoyeesTrouvees = (dejaEnvoyees ?? []).filter((c) => correspondRecherche(c.figurants, recherche)).slice(0, 8);

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
    if (ordre === "nom") return comparerNoms(a.figurants, b.figurants);
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

  // Pagination — appliquée AVANT les lookups coûteux ci-dessous (photos,
  // réponses) pour ne jamais générer d'URL signées pour des centaines de
  // candidatures qui ne seront pas affichées sur cette page.
  const totalPages = Math.max(1, Math.ceil(candidatures.length / CANDIDATURES_PAR_PAGE));
  const page = Math.min(totalPages, Math.max(1, Number(params.page) || 1));
  const pageCandidatures = candidatures.slice((page - 1) * CANDIDATURES_PAR_PAGE, page * CANDIDATURES_PAR_PAGE);

  // Photos de la candidature (envoyées ou reprises pour cette annonce),
  // sinon celles du compte pour les candidatures d'avant.
  const [portraitByFigurant, photosParCandidature] = await Promise.all([
    getPhotosByFigurantId(pageCandidatures.map((c) => c.figurants?.id).filter((id): id is string => !!id)),
    getPhotosParCandidature(pageCandidatures.map((c) => c.id)),
  ]);
  const photosDe = (c: (typeof pageCandidatures)[number]) =>
    photosParCandidature.get(c.id) ?? (c.figurants ? portraitByFigurant.get(c.figurants.id) : undefined);

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
      mes: (() => {
        const a = avisMes.get(c.id);
        return a ? { vote: a.vote, qui: a.visiteur_role ? `${a.visiteur_nom} (${a.visiteur_role})` : a.visiteur_nom, note: a.note } : null;
      })(),
      jours: annonceDates.map((d) => ({
        id: d.id,
        date: d.date,
        disponible: datesDispoByCandidature.get(c.id)?.has(d.id) ?? false,
        prevu: joursPrevus.get(c.id)?.has(d.id) ?? false,
        dansLaJournee: estTransfere(c.figurants?.id, d.id),
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
    portraitUrl: pickPortrait(photosDe(c))?.url ?? null,
    photos: photosDe(c) ?? [],
  }));

  // Adresse de la page avec quelques paramètres changés (les autres
  // filtres sont gardés) ; revient toujours à la première page.
  function hrefAvec(maj: Record<string, string | string[] | null>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || k in maj) continue;
      for (const x of toList(v as string | string[] | undefined)) if (x) sp.append(k, x);
    }
    for (const [k, v] of Object.entries(maj)) for (const x of toList(v ?? undefined)) sp.append(k, x);
    return `/candidatures?${sp.toString()}`;
  }
  const pageHref = (p: number) => {
    const href = hrefAvec({});
    return p > 1 ? `${href}&page=${p}` : href;
  };

  // Panneau « Jours de tournage » : par date, la journée telle qu'elle est
  // dans Bookings (besoins, présent·es, statuts) et les prévu·es d'ici.
  const besoinsParDate = new Map((journeesBesoins ?? []).map((j) => [j.date, j.journee_besoins]));
  // Jour ouvert en grand (trombi) : photos signées pour ce jour seulement.
  const jourVu = annonceDates.find((d) => d.id === params.jour_vu) ?? null;
  const bookingsJourVu = jourVu ? (bookingsJours ?? []).filter((b) => b.date === jourVu.date) : [];
  const photosJourVu = await getPhotosByFigurantId(bookingsJourVu.map((b) => b.figurant_id));
  const jours: JourPanneau[] = annonceDates.map((d) => {
    const bookings = (bookingsJours ?? []).filter((b) => b.date === d.date && !HORS_JOURNEE.includes(b.statut));
    const besoins = besoinsParDate.get(d.date) ?? [];
    const total = besoins.reduce((s, b) => s + b.quantite, 0);
    const prevues = (joursRows ?? []).filter((j) => j.annonce_date_id === d.id);
    const dispoActif = dispoFilter.length === 1 && dispoFilter[0] === d.id;
    return {
      id: d.id,
      date: d.date,
      besoin: total > 0 ? total : null,
      dansLaJournee: bookings.length,
      stats: {
        confirmes: bookings.filter((b) => b.statut === "confirmé").length,
        proposes: bookings.filter((b) => b.statut === "proposé").length,
        per: bookings.filter((b) => b.statut === "envoyé").length,
      },
      fonctions: besoins.map((b) => ({
        fonction: b.fonction,
        besoin: b.quantite,
        places: bookings.filter((x) => sansAccent(x.fonction ?? "") === sansAccent(b.fonction)).length,
      })),
      gens: trierParNom(bookings, (b) => b.figurants).map((b) => ({
        bookingId: b.id,
        nom: nomComplet(b.figurants) || "—",
        statut: b.statut,
        fonction: b.fonction,
        portraitUrl: d.id === jourVu?.id ? (pickPortrait(photosJourVu.get(b.figurant_id), annonce?.projet_id)?.url ?? null) : null,
      })),
      horsJournee: (bookingsJours ?? []).filter((b) => b.date === d.date && HORS_JOURNEE.includes(b.statut)).length,
      vu: d.id === jourVu?.id,
      vuHref: hrefAvec({ jour_vu: d.id === jourVu?.id ? null : d.id }),
      prevus: prevues.length,
      prevusAEnvoyer: prevues.filter((j) => !estTransfere(j.candidatures?.figurant_id, d.id)).length,
      dispoHref: hrefAvec({ dispo: dispoActif ? null : d.id }),
      dispoActif,
      prevusHref: hrefAvec({ jour: d.id }),
    };
  });

  const projetOption = annonce ? [{ id: annonce.projet_id, nom: annonce.projets?.nom ?? "" }] : [];

  // Onglets du classeur : À trier, les onglets de rangement, Tous, OUT.
  const ongletOut = onglets.find((o) => o.fixe);
  const tabs = [
    { key: "a_trier", label: "📥 À trier" },
    ...onglets.filter((o) => !o.fixe).map((o) => ({ key: o.id, label: `${emojiOnglet(o)} ${o.nom}` })),
    ...(liensValidation.liens.length > 0 || onglet === "mes" ? [{ key: "mes", label: "🎬 Validés MES" }] : []),
    { key: "tous", label: "👥 Tous" },
    ...(ongletOut ? [{ key: ongletOut.id, label: `🚫 ${ongletOut.nom}` }] : []),
  ];

  // Filtres actifs, chacun retirable d'un clic.
  const labelDate = (id: string) => formatDayMonth(dateIsoById.get(id) ?? "");
  const ageLabel =
    AGES.find((a) => a.min === (params.age_min ?? "") && a.max === (params.age_max ?? ""))?.label ??
    (params.age_min || params.age_max ? `${params.age_min || "…"}–${params.age_max || "…"} ans` : null);
  const question = annonceQuestions.find((q) => q.id === params.question_id);
  const actifs: { label: string; href: string }[] = [
    ...(recherche ? [{ label: `« ${recherche} »`, href: hrefAvec({ q: null }) }] : []),
    ...(params.genre ? [{ label: GENRE_LABELS[params.genre] ?? params.genre, href: hrefAvec({ genre: null }) }] : []),
    ...(ageLabel ? [{ label: ageLabel, href: hrefAvec({ age_min: null, age_max: null }) }] : []),
    ...dispoFilter.map((id) => ({
      label: `Dispo le ${labelDate(id)}`,
      href: hrefAvec({ dispo: dispoFilter.filter((x) => x !== id) }),
    })),
    ...(jourFilter ? [{ label: `Prévu·es le ${labelDate(jourFilter)}`, href: hrefAvec({ jour: null }) }] : []),
    ...(question
      ? [{ label: `${question.label} : ${params.question_reponse ?? "oui"}`, href: hrefAvec({ question_id: null, question_reponse: null }) }]
      : []),
    ...(params.myrole
      ? [{ label: params.myrole === "oui" ? "Avec compte Myrole" : "Sans compte Myrole", href: hrefAvec({ myrole: null }) }]
      : []),
    ...(params.vehicule && VEHICULES[params.vehicule]
      ? [{ label: VEHICULES[params.vehicule], href: hrefAvec({ vehicule: null }) }]
      : []),
    ...(params.code_postal ? [{ label: `CP ${params.code_postal}`, href: hrefAvec({ code_postal: null }) }] : []),
    ...MENSURATION_TEXT_FIELDS.filter((f) => params[f.key]).map((f) => ({
      label: `${f.label} ${params[f.key]}`,
      href: hrefAvec({ [f.key]: null }),
    })),
    ...MENSURATION_RANGE_FIELDS.filter((f) => params[`${f.key}_min`] || params[`${f.key}_max`]).map((f) => ({
      label: `${f.label} ${params[`${f.key}_min`] || "…"}–${params[`${f.key}_max`] || "…"}`,
      href: hrefAvec({ [`${f.key}_min`]: null, [`${f.key}_max`]: null }),
    })),
  ];
  const toutEffacer = `/candidatures?${new URLSearchParams({
    annonce_id: annonceId,
    ...(onglet !== "a_trier" ? { onglet_id: onglet } : {}),
    ...(ordre !== "recentes" ? { ordre } : {}),
    ...(vue === "liste" ? { vue } : {}),
  })}`;
  const plusActifs = [
    params.myrole,
    params.vehicule,
    params.code_postal,
    ...MENSURATION_TEXT_FIELDS.map((f) => params[f.key]),
    ...MENSURATION_RANGE_FIELDS.map((f) => params[`${f.key}_min`] || params[`${f.key}_max`]),
  ].filter(Boolean).length;

  // « Plus de filtres » : formulaire classique, les autres filtres suivent
  // en champs cachés.
  const cachesPlus = Object.entries(params).flatMap(([k, v]) =>
    [
      "myrole",
      "vehicule",
      "page",
      "code_postal",
      ...MENSURATION_TEXT_FIELDS.map((f) => f.key),
      ...MENSURATION_RANGE_FIELDS.flatMap((f) => [`${f.key}_min`, `${f.key}_max`]),
    ].includes(k)
      ? []
      : toList(v as string | string[] | undefined).map((x, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={x} />)
  );
  const plus = (
    <form method="get" className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-ink-raised p-3 md:grid-cols-4">
      {cachesPlus}
      <Select name="myrole" defaultValue={params.myrole ?? ""}>
        <option value="">Myrole (tous)</option>
        <option value="oui">Avec compte Myrole</option>
        <option value="non">Sans compte Myrole</option>
      </Select>
      <Select name="vehicule" defaultValue={params.vehicule ?? ""}>
        <option value="">Véhicule (tous)</option>
        {Object.entries(VEHICULES).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </Select>
      <MensurationsFilterPanel defaultValues={params} />
      <Button type="submit" className="col-span-2 md:col-span-1">
        Appliquer
      </Button>
    </form>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          <Link href="/candidatures" className="hover:text-text">
            ← Candidatures
          </Link>
          <Link href="/candidatures" className="ml-3 text-coral hover:underline">
            Changer d&apos;annonce
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{annonce?.titre ?? "Annonce"}</h1>
            <p className="mt-1 text-text-muted">
              {projetNomPublic(annonce?.projets)}
              {annonce?.lieu ? ` · ${annonce.lieu}` : ""}
              {annonceDates.length > 0 && ` · ${annonceDates.map((d) => formatDayMonth(d.date)).join(", ")}`}
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
                    annonce_id: annonceId,
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

      {/* Classeur : une étape du tri par onglet. */}
      <nav aria-label="Étapes du tri" className="flex flex-wrap items-end gap-1 border-b-2 border-border">
        {tabs.map((t) => {
          const actif = onglet === t.key;
          return (
            <Link
              key={t.key}
              href={hrefAvec({ onglet_id: t.key === "a_trier" ? null : t.key })}
              aria-current={actif ? "page" : undefined}
              scroll={false}
              className={cn(
                "-mb-0.5 flex items-center gap-1.5 rounded-t-xl border-2 px-3.5 py-2 text-sm font-medium transition-colors",
                actif
                  ? "border-border border-b-ink bg-ink text-text"
                  : "border-transparent text-text-muted hover:bg-ink-raised hover:text-text"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                  actif ? "bg-coral/15 text-coral" : "bg-ink-raised-2"
                )}
              >
                {tabCounts[t.key] ?? 0}
              </span>
            </Link>
          );
        })}
        <NouvelOnglet annonceId={annonceId} hrefOnglet={hrefAvec({ onglet_id: "__ONGLET__" })} />
      </nav>

      <FiltresCandidatures
        genres={GENRES.map((g) => ({ value: g, label: GENRE_LABELS[g] ?? g }))}
        dates={annonceDates.map((d) => ({
          id: d.id,
          label: `${formatDayMonth(d.date)} (${dispoCountByDate.get(d.id) ?? 0})`,
        }))}
        questions={annonceQuestions.map((q) => ({ id: q.id, label: q.label }))}
        plusActifs={plusActifs}
        plus={plus}
      />

      {actifs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {actifs.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              scroll={false}
              className="flex items-center gap-1 rounded-full border border-coral/50 bg-coral/10 px-2.5 py-1 text-xs font-medium text-coral hover:border-coral"
              aria-label={`Retirer le filtre ${a.label}`}
            >
              {a.label} <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href={toutEffacer} scroll={false} className="ml-1 text-xs font-medium text-text-muted underline hover:text-text">
            Tout effacer
          </Link>
          <span className="ml-auto text-xs text-text-muted">
            {candidatures.length} profil{candidatures.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {(ailleurs.length > 0 || envoyeesTrouvees.length > 0) && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-yellow/40 bg-yellow/10 px-3 py-2 text-xs">
          <span className="font-medium">Aussi trouvé ailleurs :</span>
          {ailleurs.map((a) => (
            <Link key={a.id} href={a.href} className="font-medium text-coral hover:underline">
              {a.nom} → {a.onglet}
            </Link>
          ))}
          {envoyeesTrouvees.map((c) => (
            <span key={c.id}>
              {nomComplet(c.figurants)} → déjà envoyé·e dans une journée
            </span>
          ))}
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error.message}
        </div>
      )}

      <CandidaturesTable
        rows={pagedRows}
        summaries={summaries}
        onglets={onglets}
        projetId={annonce?.projet_id ?? null}
        projets={projetOption}
        triIds={candidatures.map((c) => c.id)}
        vue={vue}
        recherche={recherche}
        jours={jours}
        templates={templates}
        liens={liensValidation.liens}
        liensOuverts={params.liens === "1"}
        origin={origin}
        nomLienParDefaut={annonce?.titre ?? "Validation"}
        annonceId={annonceId}
        pagination={
          <>
            {pagedRows.length === 0 && (
              <p className="py-10 text-center text-sm text-text-muted">
                {onglet === "a_trier" && actifs.length === 0
                  ? "Plus personne à trier 🎉"
                  : "Personne dans cet onglet avec ces filtres."}
              </p>
            )}
            {totalPages > 1 && (
              <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-2 text-sm">
                {[
                  { label: "« Première", cible: 1, inactif: page <= 1 },
                  { label: "← Précédent", cible: page - 1, inactif: page <= 1 },
                ].map((b) => (
                  <Link
                    key={b.label}
                    href={pageHref(b.cible)}
                    aria-disabled={b.inactif}
                    className={cn(
                      "rounded-full border border-border-strong px-4 py-2 font-medium transition-colors",
                      b.inactif ? "pointer-events-none opacity-40" : "hover:border-coral/60 hover:text-text"
                    )}
                  >
                    {b.label}
                  </Link>
                ))}
                {/* Numéros : la première, la dernière et les deux voisines de la
                    page en cours, « … » entre les trous. */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .flatMap((p, i, liste) => [
                    ...(i > 0 && p - liste[i - 1] > 1 ? [<span key={`trou-${p}`} className="text-text-muted">…</span>] : []),
                    <Link
                      key={p}
                      href={pageHref(p)}
                      aria-current={p === page ? "page" : undefined}
                      className={cn(
                        "min-w-9 rounded-full border px-3 py-2 text-center font-medium tabular-nums transition-colors",
                        p === page
                          ? "pointer-events-none border-coral bg-coral/15 text-coral"
                          : "border-border-strong text-text hover:border-coral/60 hover:text-text"
                      )}
                    >
                      {p}
                    </Link>,
                  ])}
                {[
                  { label: "Suivant →", cible: page + 1, inactif: page >= totalPages },
                  { label: "Dernière »", cible: totalPages, inactif: page >= totalPages },
                ].map((b) => (
                  <Link
                    key={b.label}
                    href={pageHref(b.cible)}
                    aria-disabled={b.inactif}
                    className={cn(
                      "rounded-full border border-border-strong px-4 py-2 font-medium transition-colors",
                      b.inactif ? "pointer-events-none opacity-40" : "hover:border-coral/60 hover:text-text"
                    )}
                  >
                    {b.label}
                  </Link>
                ))}
              </nav>
            )}
          </>
        }
      />
    </div>
  );
}
