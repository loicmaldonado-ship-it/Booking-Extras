import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { profilDuRelais } from "@/lib/textos/relais";
import { enregistrerReponsesTextos, type ReponseTexto } from "@/lib/textos/reponses";

export const dynamic = "force-dynamic";

// Le relais Mac envoie les réponses texto reçues dans l'app Messages (ou une
// erreur, ex. accès à Messages pas encore autorisé sur le Mac).
export async function POST(request: Request) {
  const profileId = await profilDuRelais(request);
  if (!profileId) return NextResponse.json({ error: "Clé du relais invalide." }, { status: 401 });
  let corps: { reponses?: ReponseTexto[]; erreur?: string } = {};
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  const nouvelles = corps.erreur ? 0 : await enregistrerReponsesTextos(profileId, Array.isArray(corps.reponses) ? corps.reponses : []);
  await createAdminClient()
    .from("relais_textos")
    .update({ reponses_le: new Date().toISOString(), reponses_erreur: corps.erreur ? String(corps.erreur).slice(0, 300) : null })
    .eq("profile_id", profileId);
  return NextResponse.json({ ok: true, nouvelles });
}
