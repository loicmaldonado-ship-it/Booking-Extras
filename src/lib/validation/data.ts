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
};

export async function getLienParToken(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient()
    .from("liens_validation")
    .select("id, token, nom, annonce_id, projet_id, created_at, annonces(titre), projets(nom, confidentiel, nom_code, societe_production)")
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
  // Jours de tournage de l'annonce où la personne est prévue (avant
  // l'envoi dans la journée), et ceux où elle s'est dite dispo.
  joursPrevus: string[];
  joursDispo: string[];
};

const LIBELLES: Record<string, string> = { portrait: "Portrait", pied: "En pied", autre: "Photo", tenue: "Essayage" };

// Planches d'un lien : identité, âge, mensurations, photos et réponses aux
// questions. Ni coordonnées ni message de candidature (demande de Loïc).
export async function getPlanches(lienId: string, projetId: string, annonceId: string): Promise<Planche[]> {
  const supabase = createAdminClient();
  const { data: lignes } = await supabase
    .from("lien_validation_profils")
    .select(
      "candidature_id, ordre, candidatures(id, figurants(id, prenom, nom, genre, date_naissance, taille_cm, pointure, veste, pantalon))"
    )
    .eq("lien_id", lienId)
    .order("ordre")
    .order("created_at")
    .returns<
      {
        candidature_id: string;
        candidatures: {
          id: string;
          figurants: {
            id: string;
            prenom: string;
            nom: string;
            genre: string | null;
            date_naissance: string | null;
            taille_cm: number | null;
            pointure: number | null;
            veste: string | null;
            pantalon: string | null;
          } | null;
        } | null;
      }[]
    >();
  const profils = (lignes ?? []).filter((l) => l.candidatures?.figurants);
  const candidatureIds = profils.map((l) => l.candidature_id);
  const [photosCandidature, photosFigurant, { data: reponses }, { data: dates }, { data: prevus }, { data: dispos }] = await Promise.all([
    getPhotosParCandidature(candidatureIds),
    getPhotosByFigurantId(profils.map((l) => l.candidatures!.figurants!.id)),
    candidatureIds.length > 0
      ? supabase
          .from("candidature_reponses")
          .select("candidature_id, reponse, annonce_questions(label, ordre)")
          .in("candidature_id", candidatureIds)
          .returns<{ candidature_id: string; reponse: boolean; annonce_questions: { label: string; ordre: number | null } | null }[]>()
      : Promise.resolve({ data: [] }),
    supabase.from("annonce_dates").select("id, date").eq("annonce_id", annonceId).order("date"),
    candidatureIds.length > 0
      ? supabase.from("candidature_jours").select("candidature_id, annonce_date_id").in("candidature_id", candidatureIds)
      : Promise.resolve({ data: [] as { candidature_id: string; annonce_date_id: string }[] }),
    candidatureIds.length > 0
      ? supabase
          .from("candidature_disponibilites")
          .select("candidature_id, annonce_date_id")
          .in("candidature_id", candidatureIds)
          .eq("disponible", true)
      : Promise.resolve({ data: [] as { candidature_id: string; annonce_date_id: string }[] }),
  ]);
  const dateDe = new Map((dates ?? []).map((d) => [d.id, d.date]));
  const datesDe = (lignes: { candidature_id: string; annonce_date_id: string }[] | null, cid: string) =>
    (lignes ?? [])
      .filter((x) => x.candidature_id === cid && dateDe.has(x.annonce_date_id))
      .map((x) => dateDe.get(x.annonce_date_id)!)
      .sort();

  return profils.map((l) => {
    const f = l.candidatures!.figurants!;
    const sources = photosCandidature.get(l.candidature_id) ?? photosFigurant.get(f.id) ?? [];
    const photos = sources
      .filter((p) => p.url && TYPES_PHOTOS.includes(p.type) && (p.type !== "tenue" || p.projet_id === projetId))
      // Portrait d'abord.
      .sort((a, b) => Number(b.type === "portrait") - Number(a.type === "portrait"))
      .map((p) => ({ url: p.url!, label: LIBELLES[p.type] ?? "Photo" }));
    return {
      candidatureId: l.candidature_id,
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
        .filter((r) => r.candidature_id === l.candidature_id && r.annonce_questions)
        .sort((a, b) => (a.annonce_questions!.ordre ?? 0) - (b.annonce_questions!.ordre ?? 0))
        .map((r) => ({ label: r.annonce_questions!.label, reponse: r.reponse })),
      joursPrevus: datesDe(prevus, l.candidature_id),
      joursDispo: datesDe(dispos, l.candidature_id),
    };
  });
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
    .select("id, token, nom, created_at, createur:profiles!liens_validation_created_by_fkey(prenom, nom), lien_validation_profils(candidature_id)")
    .eq("annonce_id", annonceId)
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        token: string;
        nom: string;
        created_at: string;
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
        candidatureIds: l.lien_validation_profils.map((p) => p.candidature_id),
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
