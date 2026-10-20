import { NextResponse, after } from "next/server";
import { alleger, cheminVideoValide } from "@/lib/casting/allegement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Durée max d'un allègement (ffmpeg) : voir allegement.ts.
export const maxDuration = 300;

// Lancé par le navigateur juste après l'ajout d'une vidéo (candidat ou
// équipe) : répond tout de suite, l'allègement tourne ensuite en arrière-plan.
// Public comme le lien d'envoi : le chemin doit désigner une vidéo déjà
// rattachée à un profil, et chaque vidéo n'est traitée qu'une fois.
export async function POST(request: Request) {
  const corps = (await request.json().catch(() => null)) as { path?: string } | null;
  const path = corps?.path;
  if (typeof path !== "string" || !cheminVideoValide(path)) {
    return NextResponse.json({ error: "Chemin invalide." }, { status: 400 });
  }
  after(async () => {
    const res = await alleger(path);
    console.info("[alleger]", path, JSON.stringify(res));
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
