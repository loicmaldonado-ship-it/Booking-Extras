import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";

// Volontairement HORS d'un fichier "use server" (BUG-02, 30/10/2026) : toute fonction exportée d'un fichier
// "use server" devient une action appelable directement depuis le navigateur. Exposée ainsi, upsertAgent
// permettait à n'importe quel membre d'équipe connecté d'écraser l'agence, l'email ou le téléphone d'un
// agent du répertoire commun, dont la gestion est réservée à la propriétaire. Elle n'est plus appelée que
// par les actions de fiche figurant, qui vérifient l'accès à la fiche avant.

// Names and emails are literal values, never SQL LIKE patterns.
function literalLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Rattache/complète un agent dans la base commune à partir d'une saisie
// staff (fiche figurant, carte casting) — jamais appelé depuis le
// formulaire public de candidature. Dédoublonne par email si fourni, sinon
// par nom (insensible à la casse), pour éviter un doublon "Jean Dupont" /
// "jean dupont" créé séparément à chaque fiche saisie à la main.
export async function upsertAgent(agent: {
  nom: string;
  agence?: string | null;
  email?: string | null;
  telephone?: string | null;
}): Promise<{ error?: string }> {
  if (!(await getCurrentProfile())) return { error: "Non autorisé." };
  if (!agent.nom?.trim()) return { error: "Le nom de l'agent est obligatoire." };

  const supabase = createAdminClient();

  let existing: { id: string } | null = null;
  if (agent.email) {
    const { data, error } = await supabase.from("agents").select("id").ilike("email", literalLike(agent.email)).maybeSingle();
    if (error) return { error: "Impossible de vérifier l'agent par email." };
    existing = data;
  }
  if (!existing) {
    const { data, error } = await supabase.from("agents").select("id").ilike("nom", literalLike(agent.nom)).maybeSingle();
    if (error) return { error: "Impossible de vérifier l'agent par nom." };
    existing = data;
  }

  const payload = {
    nom: agent.nom,
    agence: agent.agence ?? null,
    email: agent.email ?? null,
    telephone: agent.telephone ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase.from("agents").update(payload).eq("id", existing.id).select("id");
    if (error || data?.length !== 1) return { error: "L'agent n'a pas pu être mis à jour." };
  } else {
    const { error } = await supabase.from("agents").insert(payload);
    if (error) return { error: "L'agent n'a pas pu être enregistré." };
  }
  return {};
}
