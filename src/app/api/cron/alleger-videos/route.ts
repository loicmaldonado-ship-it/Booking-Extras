import { NextResponse, type NextRequest } from "next/server";
import { alleger, prochainesAAlleger } from "@/lib/casting/allegement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Tâche planifiée Vercel (toutes les 10 min) : filet de sécurité qui allège
// les vidéos que le déclenchement immédiat n'a pas traitées (onglet fermé
// trop tôt, délai dépassé, erreur). Une vidéo par passage.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const [path] = await prochainesAAlleger(1);
  if (!path) return NextResponse.json({ ok: true, rien: true });
  return NextResponse.json({ ok: true, path, ...(await alleger(path)) });
}
