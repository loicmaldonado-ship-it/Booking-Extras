import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartageType } from "@/lib/partage/actions";

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
