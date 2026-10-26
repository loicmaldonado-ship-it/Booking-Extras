import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { profilDuRelais } from "@/lib/textos/relais";

export const dynamic = "force-dynamic";

// Le relais Mac demande le prochain texto à envoyer (un seul à la fois :
// avec la vérification et les nouveaux essais, un envoi peut durer
// quelques minutes). Un texto « pris » depuis plus de 20 min sans résultat (Mac éteint
// en plein envoi) est remis en file.
export async function POST(request: Request) {
  const profileId = await profilDuRelais(request);
  if (!profileId) return NextResponse.json({ error: "Clé du relais invalide." }, { status: 401 });
  const supabase = createAdminClient();

  await supabase
    .from("textos_file")
    .update({ statut: "en_attente", pris_le: null })
    .eq("profile_id", profileId)
    .eq("statut", "envoi")
    .lt("pris_le", new Date(Date.now() - 20 * 60_000).toISOString());

  const { data: suivants } = await supabase
    .from("textos_file")
    .select("id, telephone, message, destinataire")
    .eq("profile_id", profileId)
    .eq("statut", "en_attente")
    .order("created_at")
    .limit(1);
  const ids = (suivants ?? []).map((t) => t.id);
  if (ids.length > 0) {
    await supabase.from("textos_file").update({ statut: "envoi", pris_le: new Date().toISOString() }).in("id", ids);
  }
  return NextResponse.json({ textos: suivants ?? [] });
}
