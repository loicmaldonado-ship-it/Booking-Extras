import { NextResponse, type NextRequest } from "next/server";
import { releverReponsesMail } from "@/lib/email/releve";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Tâche planifiée Vercel (vercel.json, toutes les 5 min) : relève les
// réponses par mail dans la boîte d'envoi de chaque projet.
// CRON_SECRET est obligatoire, y compris en cas de mauvaise configuration.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const resultats = await releverReponsesMail();
  return NextResponse.json({
    ok: true,
    boites: resultats.length,
    nouvelles: resultats.reduce((n, r) => n + r.nouvelles, 0),
    erreurs: resultats.filter((r) => r.erreur).length,
  });
}
