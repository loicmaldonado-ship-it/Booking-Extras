import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartageType, CategorieLien } from "@/lib/partage/actions";

export async function getSiteOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function resolvePartageToken(token: string, type: PartageType) {
  const supabase = createAdminClient();
  const { data: lien } = await supabase
    .from("partage_liens")
    .select("projet_id")
    .eq("token", token)
    .eq("type", type)
    .maybeSingle();

  if (!lien) return null;

  const { data: projet } = await supabase
    .from("projets")
    .select("id, nom, confidentiel, nom_code, realisateur, societe_production")
    .eq("id", lien.projet_id)
    .single();

  return projet;
}

// Catégorie couverte par un lien casting : null = tout le casting.
export async function getCategorieLienCasting(token: string): Promise<CategorieLien> {
  const { data } = await createAdminClient().from("partage_liens").select("categorie").eq("token", token).eq("type", "casting").maybeSingle();
  return (data?.categorie ?? null) as CategorieLien;
}

export async function getPartageTitreByToken(token: string, type: PartageType) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("partage_liens").select("titre").eq("token", token).eq("type", type).maybeSingle();
  return data?.titre ?? null;
}

export type CastingDocsVisibility = {
  listeArtistique: boolean;
  fichesRoles: boolean;
  distribution: boolean;
  fichesRolesMasquerContact: boolean;
};

export async function getCastingDocsVisibility(projetId: string, categorie: CategorieLien = null): Promise<CastingDocsVisibility> {
  const supabase = createAdminClient();
  const base = supabase
    .from("partage_liens")
    .select("liste_artistique_visible, fiches_roles_visible, distribution_visible, fiches_roles_masquer_contact")
    .eq("projet_id", projetId)
    .eq("type", "casting");
  const { data } = await (categorie ? base.eq("categorie", categorie) : base.is("categorie", null)).maybeSingle();
  return {
    listeArtistique: data?.liste_artistique_visible ?? false,
    fichesRoles: data?.fiches_roles_visible ?? false,
    distribution: data?.distribution_visible ?? false,
    fichesRolesMasquerContact: data?.fiches_roles_masquer_contact ?? false,
  };
}

export async function getCastingDocsVisibilityByToken(token: string): Promise<CastingDocsVisibility> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("partage_liens")
    .select("liste_artistique_visible, fiches_roles_visible, distribution_visible, fiches_roles_masquer_contact")
    .eq("token", token)
    .eq("type", "casting")
    .maybeSingle();
  return {
    listeArtistique: data?.liste_artistique_visible ?? false,
    fichesRoles: data?.fiches_roles_visible ?? false,
    distribution: data?.distribution_visible ?? false,
    fichesRolesMasquerContact: data?.fiches_roles_masquer_contact ?? false,
  };
}

// Ce que le·la réal voit et peut faire sur le lien casting (réglé côté
// équipe, par lien).
export type OptionsReel = {
  age: boolean;
  ville: boolean;
  taille: boolean;
  mensurations: boolean;
  reponses: boolean;
  avis: boolean;
  commentairesProfil: boolean;
};

export const OPTIONS_REEL_PAR_DEFAUT: OptionsReel = {
  age: true,
  ville: false,
  taille: true,
  mensurations: true,
  reponses: true,
  avis: true,
  commentairesProfil: true,
};

export const COLONNES_OPTIONS_REEL: Record<keyof OptionsReel, string> = {
  age: "reel_afficher_age",
  ville: "reel_afficher_ville",
  taille: "reel_afficher_taille",
  mensurations: "reel_afficher_mensurations",
  reponses: "reel_afficher_reponses",
  avis: "reel_avis",
  commentairesProfil: "reel_commentaires_profil",
};

export async function getReelOptions(filtre: { token: string } | { projetId: string; categorie?: CategorieLien }): Promise<OptionsReel> {
  let q = createAdminClient()
    .from("partage_liens")
    .select(Object.values(COLONNES_OPTIONS_REEL).join(", "))
    .eq("type", "casting");
  if ("token" in filtre) q = q.eq("token", filtre.token);
  else {
    q = q.eq("projet_id", filtre.projetId);
    q = filtre.categorie ? q.eq("categorie", filtre.categorie) : q.is("categorie", null);
  }
  const { data } = await q.maybeSingle<Record<string, boolean>>();
  if (!data) return OPTIONS_REEL_PAR_DEFAUT;
  return Object.fromEntries(
    (Object.keys(COLONNES_OPTIONS_REEL) as (keyof OptionsReel)[]).map((k) => [k, data[COLONNES_OPTIONS_REEL[k]] ?? OPTIONS_REEL_PAR_DEFAUT[k]])
  ) as OptionsReel;
}

type ProjetPublic = {
  id: string;
  nom: string;
  confidentiel: boolean;
  nom_code: string | null;
  realisateur: string | null;
  societe_production: string | null;
};

export type DocumentsShareContext = {
  projet: ProjetPublic;
  // Non-null when the link is scoped to a single journée: overrides any
  // ?date= tampering so a journée-scoped link can never browse other dates.
  dateLock: string | null;
  showContacts: boolean;
};

// Resolves a trombis/fiches share token against either the whole-project
// link (partage_liens, always shows contacts) or a single-journée link
// (partage_journee_liens, contacts visibility chosen at creation time).
export async function resolveDocumentsShareToken(token: string): Promise<DocumentsShareContext | null> {
  const supabase = createAdminClient();

  const { data: journeeLien } = await supabase
    .from("partage_journee_liens")
    .select("projet_id, date, show_contacts")
    .eq("token", token)
    .maybeSingle();

  if (journeeLien) {
    const { data: projet } = await supabase
      .from("projets")
      .select("id, nom, confidentiel, nom_code, realisateur, societe_production")
      .eq("id", journeeLien.projet_id)
      .single();
    if (!projet) return null;
    return { projet, dateLock: journeeLien.date, showContacts: journeeLien.show_contacts };
  }

  const projet = await resolvePartageToken(token, "documents");
  if (!projet) return null;
  return { projet, dateLock: null, showContacts: true };
}
