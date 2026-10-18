import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { releverReponsesMail } from "@/lib/email/releve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Tâche planifiée Vercel (vercel.json, toutes les 5 min) : relève les
// réponses par mail dans la boîte d'envoi de chaque projet. Avec CRON_SECRET
// défini dans Vercel, seule la tâche planifiée peut l'appeler ; sans, un
// appel extérieur reste sans effet s'il arrive moins de 2 min après le
// précédent (lecture seule des boîtes, aucun envoi).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!secret) {
    const { data } = await createAdminClient()
      .from("boites_mail_releve")
      .select("releve_le")
      .order("releve_le", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.releve_le && Date.now() - new Date(data.releve_le).getTime() < 2 * 60 * 1000) {
      return NextResponse.json({ ok: true, ignore: "trop rapproché" });
    }
  }
  const resultats = await releverReponsesMail();
  return NextResponse.json({
    ok: true,
    boites: resultats.length,
    nouvelles: resultats.reduce((n, r) => n + r.nouvelles, 0),
    erreurs: resultats.filter((r) => r.erreur).length,
  });
}
