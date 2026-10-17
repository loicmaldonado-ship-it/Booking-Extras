import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { profilDuRelais } from "@/lib/textos/relais";

export const dynamic = "force-dynamic";

// Le relais Mac indique si un texto est parti (ou pourquoi il a échoué).
export async function POST(request: Request) {
  const profileId = await profilDuRelais(request);
  if (!profileId) return NextResponse.json({ error: "Clé du relais invalide." }, { status: 401 });
  const corps = (await request.json().catch(() => null)) as { id?: string; ok?: boolean; erreur?: string } | null;
  if (!corps?.id) return NextResponse.json({ error: "id manquant" }, { status: 400 });

  const { error } = await createAdminClient()
    .from("textos_file")
    .update(
      corps.ok
        ? { statut: "envoye", envoye_le: new Date().toISOString(), erreur: null }
        : { statut: "erreur", erreur: String(corps.erreur ?? "Échec").slice(0, 500) }
    )
    .eq("id", corps.id)
    .eq("profile_id", profileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
