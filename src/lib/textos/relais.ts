import "server-only";
import { communicationsDesactivees } from "@/lib/communications-test";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function hacherCle(cle: string) {
  return crypto.createHash("sha256").update(cle).digest("hex");
}

// Relais du Mac : identifié par sa clé (en-tête Authorization: Bearer …).
export async function profilDuRelais(request: Request): Promise<string | null> {
  if (communicationsDesactivees()) return null;
  const entete = request.headers.get("authorization") ?? "";
  const cle = entete.startsWith("Bearer ") ? entete.slice(7).trim() : "";
  if (cle.length < 20) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.from("relais_textos").select("profile_id").eq("cle_hash", hacherCle(cle)).maybeSingle();
  if (!data) return null;
  await supabase.from("relais_textos").update({ derniere_activite: new Date().toISOString() }).eq("profile_id", data.profile_id);
  return data.profile_id;
}
