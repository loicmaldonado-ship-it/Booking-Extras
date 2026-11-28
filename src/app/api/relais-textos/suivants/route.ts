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

  const { error: relanceError } = await supabase
    .from("textos_file")
    .update({ statut: "en_attente", pris_le: null })
    .eq("profile_id", profileId)
    .eq("statut", "envoi")
    .lt("pris_le", new Date(Date.now() - 20 * 60_000).toISOString());
  if (relanceError) return NextResponse.json({ error: "File textos indisponible." }, { status: 503 });

  const { data: suivant, error: lectureError } = await supabase
    .from("textos_file")
    .select("id")
    .eq("profile_id", profileId)
    .eq("statut", "en_attente")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (lectureError) return NextResponse.json({ error: "File textos indisponible." }, { status: 503 });
  if (!suivant) return NextResponse.json({ textos: [] });

  // La condition sur le statut rend la prise atomique : deux Macs ne
  // peuvent pas récupérer le même texto, même s'ils interrogent ensemble.
  const { data: pris, error: priseError } = await supabase
    .from("textos_file")
    .update({ statut: "envoi", pris_le: new Date().toISOString() })
    .eq("id", suivant.id)
    .eq("profile_id", profileId)
    .eq("statut", "en_attente")
    .select("id, telephone, message, destinataire")
    .maybeSingle();
  if (priseError) return NextResponse.json({ error: "File textos indisponible." }, { status: 503 });
  return NextResponse.json({ textos: pris ? [pris] : [] });
}
