import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sansAccent } from "@/lib/candidatures/onglets-affichage";
import { computeAge } from "@/lib/documents/fields";
import { getPhotosByFigurantId } from "@/lib/documents/data";

// Fiches de la base qui ressemblent à une personne qu'on s'apprête à créer
// (ajout rapide) : même nom aux accents / tirets près, nom ou prénom à une
// lettre près (Dupont / Dupond), ou même téléphone écrit autrement
// (06… / +33 6…). Fiches comédien·nes exclues (privées à leur pool).

export type DoublonProbable = {
  id: string;
  nom: string;
  age: number | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  photoUrl: string | null;
  raison: string;
};

const MAX = 5;

// « Jean-Pierre » = « jean pierre » = « Jéan Pierre ».
const normaliser = (s: string) => sansAccent(s).replace(/[^a-z]/g, "");

// Motif ilike tolérant aux accents : chaque lettre accentuable devient « _ ».
const motifTolerant = (s: string) =>
  sansAccent(s.trim())
    .replace(/[\\%_]/g, "")
    .replace(/[aeiouycn]/g, "_")
    .replace(/[^a-z_]/g, "%");

// 9 derniers chiffres : 06 11 22 33 44 = +33 6 11 22 33 44.
const finTelephone = (t: string | null) => (t ?? "").replace(/\D/g, "").slice(-9);

// Distance d'édition ≤ 1 (une lettre changée, ajoutée ou retirée).
function aUneLettrePres(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

type Ligne = {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  ville: string | null;
  date_naissance: string | null;
};
const COLONNES = "id, prenom, nom, email, telephone, ville, date_naissance";

export async function doublonsProbables(personne: {
  prenom: string;
  nom: string;
  telephone: string;
}): Promise<DoublonProbable[]> {
  // Suggestions must obey the same row visibility as the current staff session.
  const supabase = await createServerSupabaseClient();
  const p = normaliser(personne.prenom);
  const n = normaliser(personne.nom);
  const tel = finTelephone(personne.telephone);

  const [{ data: parNom, error: erreurNom }, { data: parPrenom, error: erreurPrenom }, { data: parTel, error: erreurTel }] = await Promise.all([
    supabase.from("figurants").select(COLONNES).eq("est_comedien", false).ilike("nom", motifTolerant(personne.nom)).limit(500),
    supabase.from("figurants").select(COLONNES).eq("est_comedien", false).ilike("prenom", motifTolerant(personne.prenom)).limit(1000),
    tel.length === 9
      ? supabase.from("figurants").select(COLONNES).eq("est_comedien", false).ilike("telephone", `%${tel.split("").join("%")}`).limit(50)
      : Promise.resolve({ data: [] as Ligne[], error: null }),
  ]);

  if (erreurNom || erreurPrenom || erreurTel) throw new Error("Impossible de vérifier les doublons.");

  const trouves = new Map<string, { ligne: Ligne; raison: string }>();
  const noter = (l: Ligne, raison: string) => {
    if (!trouves.has(l.id)) trouves.set(l.id, { ligne: l, raison });
  };
  for (const l of (parTel ?? []) as Ligne[]) {
    if (finTelephone(l.telephone) === tel) noter(l, "même téléphone");
  }
  for (const l of [...((parNom ?? []) as Ligne[]), ...((parPrenom ?? []) as Ligne[])]) {
    const lp = normaliser(l.prenom);
    const ln = normaliser(l.nom);
    if (lp === p && ln === n) noter(l, "même nom");
    else if (aUneLettrePres(lp, p) && aUneLettrePres(ln, n)) noter(l, "nom très proche");
  }

  const liste = [...trouves.values()].slice(0, MAX);
  if (liste.length === 0) return [];
  const photos = await getPhotosByFigurantId(liste.map((t) => t.ligne.id));
  return liste.map(({ ligne, raison }) => {
    const ph = photos.get(ligne.id) ?? [];
    const portrait = ph.find((x) => x.type === "portrait" && x.url) ?? ph.find((x) => x.url);
    return {
      id: ligne.id,
      nom: `${ligne.prenom} ${ligne.nom}`,
      age: computeAge(ligne.date_naissance),
      ville: ligne.ville,
      email: ligne.email,
      telephone: ligne.telephone,
      photoUrl: portrait?.url ?? null,
      raison,
    };
  });
}
