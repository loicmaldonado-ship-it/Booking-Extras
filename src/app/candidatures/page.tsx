import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/field";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { CandidaturesTable, type Row } from "@/components/candidatures/candidatures-table";
import { SortChips } from "@/components/documents/sort-chips";
import { ONGLET_OUT_BE, type CandidatureOnglet } from "@/lib/candidatures/types";
import { GENRES } from "@/lib/figurants/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { groupByDimensions, parseDocSort, ageBracket, SORT_DIMENSIONS, type Dimension } from "@/lib/documents/sort";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import { getAnnonceQuestions } from "@/lib/annonces/questions";
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
  sort?: string | string[];
};

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
  onglet_id: string | null;
  figurants:
    | (CandidatureRaw["figurants"] & {
        genre: string | null;
        date_naissance: string | null;
        a_vehicule: boolean | null;
        vehicule_velo: boolean;
        vehicule_moto: boolean;
        vehicule_scooter: boolean;
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
                <Badge>{countByAnnonce.get(a.id) ?? 0} candidat{(countByAnnonce.get(a.id) ?? 0) > 1 ? "s" : ""}</Badge>
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
      "id, onglet_id, fonction_assignee, cachet_assigne, message, created_at, figurants(id, prenom, nom, ville, email, compte_myrole, genre, date_naissance, a_vehicule, vehicule_velo, vehicule_moto, vehicule_scooter), annonces(id, titre, projet_id, projets(nom, confidentiel, nom_code, lieu, signature))"
    )
    .eq("annonce_id", params.annonce_id)
    .order("created_at", { ascending: false });

  const annonceQuestions = await getAnnonceQuestions(params.annonce_id);

  const [
    { data: candidaturesRaw, error },
    { data: bookedCandidatures },
    { data: templates },
    { data: reponsesMatch },
    { data: onglets },
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
    supabase.from("candidature_onglets").select("id, nom, couleur, fixe, ordre").order("ordre").returns<CandidatureOnglet[]>(),
  ]);

  const bookedCandidatureIds = new Set((bookedCandidatures ?? []).map((b) => b.candidature_id));

  let candidatures = (candidaturesRaw ?? []).filter((c) => !bookedCandidatureIds.has(c.id));
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
  if (reponsesMatch) {
    const matchingIds = new Set(reponsesMatch.map((r) => r.candidature_id));
    candidatures = candidatures.filter((c) => matchingIds.has(c.id));
  }

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

  const docSort = parseDocSort(params.sort);
  const sortGroups = groupByDimensions(candidatures, docSort, candidatureDimLabel, candidatureNameOf);
  if (sortGroups) candidatures = sortGroups.flatMap((g) => g.items);

  const portraitByFigurant = await getPhotosByFigurantId(
    candidatures.map((c) => c.figurants?.id).filter((id): id is string => !!id)
  );

  const candidatureIds = candidatures.map((c) => c.id);
  const [{ data: reponsesRaw }, { data: disposRaw }] = await Promise.all([
    candidatureIds.length > 0
      ? supabase
          .from("candidature_reponses")
          .select("candidature_id, reponse, annonce_questions(label)")
          .in("candidature_id", candidatureIds)
          .returns<{ candidature_id: string; reponse: boolean; annonce_questions: { label: string } | null }[]>()
      : Promise.resolve({ data: [] as { candidature_id: string; reponse: boolean; annonce_questions: { label: string } | null }[] }),
    candidatureIds.length > 0
      ? supabase
          .from("candidature_disponibilites")
          .select("candidature_id, disponible, annonce_dates(date)")
          .in("candidature_id", candidatureIds)
          .returns<{ candidature_id: string; disponible: boolean; annonce_dates: { date: string } | null }[]>()
      : Promise.resolve({ data: [] as { candidature_id: string; disponible: boolean; annonce_dates: { date: string } | null }[] }),
  ]);

  const summaries: Record<
    string,
    { questions: { label: string; reponse: boolean }[]; dates: { date: string; disponible: boolean }[]; message: string | null }
  > = {};
  for (const c of candidatures) {
    summaries[c.id] = { questions: [], dates: [], message: c.message };
  }
  for (const r of reponsesRaw ?? []) {
    if (!r.annonce_questions) continue;
    const entry = summaries[r.candidature_id] ?? { questions: [], dates: [], message: null };
    entry.questions.push({ label: r.annonce_questions.label, reponse: r.reponse });
    summaries[r.candidature_id] = entry;
  }
  for (const d of disposRaw ?? []) {
    if (!d.annonce_dates) continue;
    const entry = summaries[d.candidature_id] ?? { questions: [], dates: [], message: null };
    entry.dates.push({ date: d.annonce_dates.date, disponible: d.disponible });
    summaries[d.candidature_id] = entry;
  }

  const rows: Row[] = candidatures.map((c) => ({
    ...c,
    portraitUrl: c.figurants ? pickPortrait(portraitByFigurant.get(c.figurants.id))?.url ?? null : null,
    photos: c.figurants ? (portraitByFigurant.get(c.figurants.id) ?? []) : [],
  }));

  const projetOption = annonce ? [{ id: annonce.projet_id, nom: annonce.projets?.nom ?? "" }] : [];

  function tabHref(ongletParam?: string) {
    const sp = new URLSearchParams();
    sp.set("annonce_id", params.annonce_id!);
    if (params.myrole) sp.set("myrole", params.myrole);
    if (params.genre) sp.set("genre", params.genre);
    if (params.vehicule) sp.set("vehicule", params.vehicule);
    if (params.age_min) sp.set("age_min", params.age_min);
    if (params.age_max) sp.set("age_max", params.age_max);
    if (params.question_id) sp.set("question_id", params.question_id);
    if (params.question_reponse) sp.set("question_reponse", params.question_reponse);
    if (ongletParam) sp.set("onglet_id", ongletParam);
    for (const dim of docSort) sp.append("sort", dim);
    return `/candidatures?${sp.toString()}`;
  }

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
              {annonce?.lieu ? ` · ${annonce.lieu}` : ""} · {rows.length} candidature{rows.length > 1 ? "s" : ""}
            </p>
          </div>
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

      <SortChips
        baseParams={{
          annonce_id: params.annonce_id,
          onglet_id: params.onglet_id,
          myrole: params.myrole,
          genre: params.genre,
          vehicule: params.vehicule,
          age_min: params.age_min,
          age_max: params.age_max,
          question_id: params.question_id,
          question_reponse: params.question_reponse,
        }}
        current={docSort}
        dimensions={CANDIDATURE_SORT_DIMENSIONS}
      />

      <Card>
        <form className="grid grid-cols-2 gap-3 md:grid-cols-4" method="get">
          <input type="hidden" name="annonce_id" value={params.annonce_id} />
          {params.onglet_id && <input type="hidden" name="onglet_id" value={params.onglet_id} />}
          {docSort.map((dim) => (
            <input key={dim} type="hidden" name="sort" value={dim} />
          ))}
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
        rows={rows}
        templates={templates ?? []}
        projets={projetOption}
        summaries={summaries}
        onglets={onglets ?? []}
      />
    </div>
  );
}
