import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MINOR_BUCKET } from "./dossiers";

// Appel réservé à l’action RGPD propriétaire, après son contrôle d’autorisation.
// Révocation avant purge : un dépôt déjà commencé sera refusé au commit SQL.
export async function purgeMinorDossiersForVerifiedChild(childId: string): Promise<{ error?: string }> {
 const admin = createAdminClient();
 const { data: dossiers, error } = await admin.from("minor_dossiers").select("id").eq("figurant_id", childId);
 if (error) return { error: "Lecture des dossiers mineurs impossible. Anonymisation non confirmée." };
 for (const dossier of dossiers ?? []) {
  const { error: revokeError } = await admin.from("minor_links").update({ revoked_at: new Date().toISOString() }).eq("dossier_id", dossier.id);
  if (revokeError) return { error: "Révocation des liens mineurs impossible. Réessaie." };
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
   const { data: files, error: listError } = await admin.storage.from(MINOR_BUCKET).list(dossier.id, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
   if (listError || !files || files.some(f => !f.id || f.name.includes("/"))) return { error: "Inventaire des pièces mineurs impossible. Les liens sont révoqués ; la purge reste à reprendre." };
   paths.push(...files.map(f => `${dossier.id}/${f.name}`));
   if (files.length < 100) break;
  }
  for (let offset = 0; offset < paths.length; offset += 100) {
   const { error: removeError } = await admin.storage.from(MINOR_BUCKET).remove(paths.slice(offset, offset + 100));
   if (removeError) return { error: "Suppression des pièces mineurs incomplète. Les liens sont révoqués ; réessaie." };
  }
  const { error: deleteError } = await admin.from("minor_dossiers").delete().eq("id", dossier.id).eq("figurant_id", childId);
  if (deleteError) return { error: "Nettoyage du dossier mineur incomplet. Réessaie." };
 }
 return {};
}
