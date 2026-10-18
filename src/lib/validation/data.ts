import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getPhotosByFigurantId, getPhotosParCandidature } from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { nomComplet } from "@/lib/noms";

export type VoteMes = "oui" | "peut" | "non";

export const EN_LIGNE_MS = 70_000;

// Photos montrables à la MES : jamais le selfie de vérification.
const TYPES_PHOTOS = ["portrait", "pied", "autre", "tenue"];

export type LienValidation = {
  id: string;
  token: string;
  nom: string;
  annonce_id: string;
  projet_id: string;
  created_at: string;
  toutes_journees: boolean;
};

export async function getLienParToken(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient()
    .from("liens_validation")
    .select("id, token, nom, annonce_id, projet_id, created_at, toutes_journees, annonces(titre), projets(nom, confidentiel, nom_code, societe_production)")
    .eq("token", token)
    .maybeSingle<
      LienValidation & {
        annonces: { titre: string } | null;
        projets: { nom: string; confidentiel: boolean; nom_code: string | null; societe_production: string | null } | null;
      }
    >();
  return data;
}

export type Planche = {
  candidatureId: string;
  nom: string;
  age: number | null;
  genre: string | null;
  // Taille, pointure, veste, pantalon (libellés traduits par la page).
  mesures: { cle: "taille" | "pointure" | "veste" | "pantalon"; valeur: string }[];
  photos: { url: string; label: string }[];
  questions: { label: string; reponse: boolean }[];
  // Jours de tournage de l'annonce : prévue (en cours de choix), déjà dans
  // la journée (booking), ou dite dispo.
  joursPrevus: string[];
  joursJournee: string[];
  joursDispo: string[];
};

const LIBELLES: Record<string, string> = { portrait: "Portrait", pied: "En pied", autre: "Photo", tenue: "Essayage" };

// Statuts qui ne comptent pas comme une place prise dans la journée.
const HORS_JOURNEE = ["annulé", "indisponible"];

type Figurant = {
  id: string;
  prenom: string;
  nom: string;
  genre: string | null;
  date_naissance: string | null;
  taille_cm: number | null;
  pointure: number | null;
  veste: string | null;
  pantalon: string | null;
};

// Les journées de l'annonce telles qu'elles se choisissent : qui est prévu
// sur chaque jour (pastilles de Candidatures) et qui y est déjà (booking sur
// le projet à cette date). Les candidatures rangées en OUT sont écartées.
export async function journeesDeLAnnonce(annonceId: string, projetId: string) {
  const supabase = createAdminClient();
  const { data: dates } = await supabase.from("annonce_dates").select("id, date").eq("annonce_id", annonceId).order("date");
  const dateDe = new Map((dates ?? []).map((d) => [d.id, d.date]));
  const prevusPar = new Map<string, string[]>();
  const journeePar = new Map<string, string[]>();
  const ajouter = (m: Map<string, string[]>, cid: string, d: string) => m.set(cid, Array.from(new Set([...(m.get(cid) ?? []), d])).sort());
  if (dateDe.size === 0) return { dates: [] as string[], prevusPar, journeePar };

  const [{ data: out }, { data: prevus }, { data: bookings }] = await Promise.all([
    supabase.from("candidature_onglets").select("id").eq("fixe", true),
    fetchAll<{ candidature_id: string; annonce_date_id: string; candidatures: { onglet_id: string | null } | null }>((from, to) =>
      supabase
        .from("candidature_jours")
        .select("candidature_id, annonce_date_id, candidatures(onglet_id)")
        .in("annonce_date_id", Array.from(dateDe.keys()))
        .order("candidature_id")
        .range(from, to)
        .returns<{ candidature_id: string; annonce_date_id: string; candidatures: { onglet_id: string | null } | null }[]>()
    ),
    fetchAll<{ figurant_id: string; date: string; statut: string }>((from, to) =>
      supabase
        .from("bookings")
        .select("figurant_id, date, statut")
        .eq("projet_id", projetId)
        .in("date", Array.from(dateDe.values()))
        .order("id")
        .range(from, to)
    ),
  ]);
  const outIds = new Set((out ?? []).map((o) => o.id));
  for (const p of prevus) {
    if (p.candidatures?.onglet_id && outIds.has(p.candidatures.onglet_id)) continue;
    ajouter(prevusPar, p.candidature_id, dateDe.get(p.annonce_date_id)!);
  }
  const actifs = bookings.filter((b) => !HORS_JOURNEE.includes(b.statut));
  const figurantIds = Array.from(new Set(actifs.map((b) => b.figurant_id)));
  for (let i = 0; i < figurantIds.length; i += 150) {
    const { data } = await supabase
      .from("candidatures")
      .select("id, figurant_id")
      .eq("annonce_id", annonceId)
      .in("figurant_id", figurantIds.slice(i, i + 150));
    for (const c of data ?? []) {
      for (const b of actifs.filter((x) => x.figurant_id === c.figurant_id)) ajouter(journeePar, c.id, b.date);
    }
  }
  return { dates: Array.from(dateDe.values()), prevusPar, journeePar };
}

// Planches d'un lien : identité, âge, mensurations, photos, réponses aux
// questions et jours. Ni coordonnées ni message de candidature. Un lien
// « toutes les journées » reprend en direct les profils prévus ou déjà
// dans chaque journée, en plus de ceux ajoutés à la main.
export async function getPlanches(lien: {
  id: string;
  projet_id: string;
  annonce_id: string;
  toutes_journees: boolean;
}): Promise<{ planches: Planche[]; dates: string[] }> {
  const supabase = createAdminClient();
  const [{ data: manuels }, journees] = await Promise.all([
    supabase.from("lien_validation_profils").select("candidature_id").eq("lien_id", lien.id).order("ordre").order("created_at"),
    journeesDeLAnnonce(lien.annonce_id, lien.projet_id),
  ]);
  const ids = Array.from(
    new Set([
      ...(manuels ?? []).map((m) => m.candidature_id),
      ...(lien.toutes_journees ? [...journees.prevusPar.keys(), ...journees.journeePar.keys()] : []),
    ])
  ).slice(0, 400);

  const lignes: { id: string; figurants: Figurant | null }[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("candidatures")
      .select("id, figurants(id, prenom, nom, genre, date_naissance, taille_cm, pointure, veste, pantalon)")
      .in("id", ids.slice(i, i + 150))
      .returns<{ id: string; figurants: Figurant | null }[]>();
    lignes.push(...(data ?? []));
  }
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const profils = ids.map((id) => parId.get(id)).filter((l): l is { id: string; figurants: Figurant } => !!l?.figurants);
  const candidatureIds = profils.map((l) => l.id);

  const [photosCandidature, photosFigurant, { data: reponses }, { data: dates }, { data: dispos }] = await Promise.all([
    getPhotosParCandidature(candidatureIds),
    getPhotosByFigurantId(profils.map((l) => l.figurants.id)),
    candidatureIds.length > 0
      ? supabase
          .from("candidature_reponses")
          .select("candidature_id, reponse, annonce_questions(label, ordre)")
          .in("candidature_id", candidatureIds)
          .returns<{ candidature_id: string; reponse: boolean; annonce_questions: { label: string; ordre: number | null } | null }[]>()
      : Promise.resolve({ data: [] }),
    supabase.from("annonce_dates").select("id, date").eq("annonce_id", lien.annonce_id),
    candidatureIds.length > 0
      ? supabase
          .from("candidature_disponibilites")
          .select("candidature_id, annonce_date_id")
          .in("candidature_id", candidatureIds)
          .eq("disponible", true)
      : Promise.resolve({ data: [] as { candidature_id: string; annonce_date_id: string }[] }),
  ]);
  const dateDe = new Map((dates ?? []).map((d) => [d.id, d.date]));

  const planches = profils.map((l) => {
    const f = l.figurants;
    const sources = photosCandidature.get(l.id) ?? photosFigurant.get(f.id) ?? [];
    const photos = sources
      .filter((p) => p.url && TYPES_PHOTOS.includes(p.type) && (p.type !== "tenue" || p.projet_id === lien.projet_id))
      // Portrait d'abord.
      .sort((a, b) => Number(b.type === "portrait") - Number(a.type === "portrait"))
      .map((p) => ({ url: p.url!, label: LIBELLES[p.type] ?? "Photo" }));
    return {
      candidatureId: l.id,
      nom: nomComplet(f),
      age: computeAge(f.date_naissance),
      genre: f.genre,
      mesures: (
        [
          ["taille", f.taille_cm ? `${f.taille_cm} cm` : null],
          ["pointure", f.pointure ? String(f.pointure) : null],
          ["veste", f.veste],
          ["pantalon", f.pantalon],
        ] as const
      )
        .filter(([, v]) => v)
        .map(([cle, valeur]) => ({ cle, valeur: valeur! })),
      photos,
      questions: (reponses ?? [])
        .filter((r) => r.candidature_id === l.id && r.annonce_questions)
        .sort((a, b) => (a.annonce_questions!.ordre ?? 0) - (b.annonce_questions!.ordre ?? 0))
        .map((r) => ({ label: r.annonce_questions!.label, reponse: r.reponse })),
      joursPrevus: journees.prevusPar.get(l.id) ?? [],
      joursJournee: journees.journeePar.get(l.id) ?? [],
      joursDispo: (dispos ?? [])
        .filter((x) => x.candidature_id === l.id && dateDe.has(x.annonce_date_id))
        .map((x) => dateDe.get(x.annonce_date_id)!)
        .sort(),
    };
  });
  return { planches, dates: journees.dates };
}

// Une candidature fait-elle partie du lien (ajoutée à la main, ou prévue /
// dans une journée pour un lien « toutes les journées ») ?
export async function candidatureDansLien(
  lien: { id: string; projet_id: string; annonce_id: string; toutes_journees: boolean },
  candidatureId: string
): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("lien_validation_profils")
    .select("candidature_id")
    .eq("lien_id", lien.id)
    .eq("candidature_id", candidatureId)
    .maybeSingle();
  if (data) return true;
  if (!lien.toutes_journees) return false;
  const j = await journeesDeLAnnonce(lien.annonce_id, lien.projet_id);
  return j.prevusPar.has(candidatureId) || j.journeePar.has(candidatureId);
}

export type VoteLigne = {
  lien_id: string;
  candidature_id: string;
  visiteur_id: string;
  visiteur_nom: string;
  visiteur_role: string;
  vote: VoteMes | null;
  note: string;
  updated_at: string;
};

export async function getVotesLiens(lienIds: string[]): Promise<VoteLigne[]> {
  if (lienIds.length === 0) return [];
  const { data } = await fetchAll<VoteLigne>((from, to) =>
    createAdminClient()
      .from("lien_validation_votes")
      .select("lien_id, candidature_id, visiteur_id, visiteur_nom, visiteur_role, vote, note, updated_at")
      .in("lien_id", lienIds)
      .order("updated_at")
      .range(from, to)
      .returns<VoteLigne[]>()
  );
  return data;
}

export type Commentaire = {
  id: string;
  auteur: string;
  equipe: boolean;
  visiteur_id: string | null;
  texte: string;
  created_at: string;
  profil: string | null;
};

export async function getCommentaires(lienIds: string[]): Promise<Map<string, Commentaire[]>> {
  const map = new Map<string, Commentaire[]>();
  if (lienIds.length === 0) return map;
  const { data } = await createAdminClient()
    .from("partage_commentaires")
    .select("id, lien_id, auteur, profile_id, visiteur_id, texte, created_at, candidatures(figurants(prenom, nom))")
    .eq("lien_type", "validation")
    .in("lien_id", lienIds)
    .order("created_at")
    .returns<
      {
        id: string;
        lien_id: string;
        auteur: string;
        profile_id: string | null;
        visiteur_id: string | null;
        texte: string;
        created_at: string;
        candidatures: { figurants: { prenom: string; nom: string } | null } | null;
      }[]
    >();
  for (const c of data ?? []) {
    const liste = map.get(c.lien_id) ?? [];
    liste.push({
      id: c.id,
      auteur: c.auteur,
      equipe: !c.visiteur_id,
      visiteur_id: c.visiteur_id,
      texte: c.texte,
      created_at: c.created_at,
      profil: c.candidatures?.figurants ? nomComplet(c.candidatures.figurants) : null,
    });
    map.set(c.lien_id, liste);
  }
  return map;
}

export type Visite = { visiteur_id: string; prenom: string; role: string; derniere_vue: string; enLigne: boolean; votes: number };

// Côté équipe : les liens de validation d'une annonce, avec qui les a
// ouverts, les votes et les commentaires.
export type LienResume = {
  id: string;
  token: string;
  nom: string;
  created_at: string;
  auteur: string | null;
  toutesJournees: boolean;
  candidatureIds: string[];
  oui: number;
  peut: number;
  non: number;
  visites: Visite[];
  commentaires: Commentaire[];
};

export async function getLiensAnnonce(annonceId: string): Promise<{ liens: LienResume[]; votes: VoteLigne[] }> {
  const supabase = createAdminClient();
  const { data: liens } = await supabase
    .from("liens_validation")
    .select("id, token, nom, created_at, toutes_journees, projet_id, createur:profiles!liens_validation_created_by_fkey(prenom, nom), lien_validation_profils(candidature_id)")
    .eq("annonce_id", annonceId)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        token: string;
        nom: string;
        created_at: string;
        toutes_journees: boolean;
        projet_id: string;
        createur: { prenom: string | null; nom: string | null } | null;
        lien_validation_profils: { candidature_id: string }[];
      }[]
    >();
  const ids = (liens ?? []).map((l) => l.id);
  const [votes, commentaires, { data: visites }] = await Promise.all([
    getVotesLiens(ids),
    getCommentaires(ids),
    ids.length > 0
      ? supabase
          .from("partage_visites")
          .select("lien_id, visiteur_id, prenom, role, derniere_vue")
          .eq("lien_type", "validation")
          .in("lien_id", ids)
          .order("derniere_vue", { ascending: false })
      : Promise.resolve({ data: [] as { lien_id: string; visiteur_id: string; prenom: string; role: string; derniere_vue: string }[] }),
  ]);
  const maintenant = Date.now();
  const lienJournees = (liens ?? []).find((l) => l.toutes_journees);
  const journees = lienJournees ? await journeesDeLAnnonce(annonceId, lienJournees.projet_id) : null;
  return {
    votes,
    liens: (liens ?? []).map((l) => {
      const votesLien = votes.filter((v) => v.lien_id === l.id);
      const parProfil = dernierVoteParCandidature(votesLien);
      const compte = (v: VoteMes) => Array.from(parProfil.values()).filter((x) => x.vote === v).length;
      return {
        id: l.id,
        token: l.token,
        nom: l.nom,
        created_at: l.created_at,
        auteur: l.createur ? nomComplet(l.createur) : null,
        toutesJournees: l.toutes_journees,
        candidatureIds: Array.from(
          new Set([
            ...l.lien_validation_profils.map((p) => p.candidature_id),
            ...(l.toutes_journees && journees ? [...journees.prevusPar.keys(), ...journees.journeePar.keys()] : []),
          ])
        ),
        oui: compte("oui"),
        peut: compte("peut"),
        non: compte("non"),
        visites: (visites ?? [])
          .filter((v) => v.lien_id === l.id)
          .map((v) => ({
            visiteur_id: v.visiteur_id,
            prenom: v.prenom,
            role: v.role,
            derniere_vue: v.derniere_vue,
            enLigne: maintenant - new Date(v.derniere_vue).getTime() < EN_LIGNE_MS,
            votes: votesLien.filter((x) => x.visiteur_id === v.visiteur_id && x.vote).length,
          })),
        commentaires: commentaires.get(l.id) ?? [],
      };
    }),
  };
}

// Dernier vote exprimé (non vide) pour chaque profil, tous votant·es
// confondu·es ; la note suit le vote.
export function dernierVoteParCandidature(votes: VoteLigne[]) {
  const map = new Map<string, VoteLigne>();
  for (const v of votes) {
    if (!v.vote && !v.note) continue;
    const avant = map.get(v.candidature_id);
    if (!avant || v.updated_at >= avant.updated_at) map.set(v.candidature_id, v);
  }
  return map;
}
