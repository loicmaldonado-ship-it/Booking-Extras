import { NextResponse } from "next/server";
import { profilDuRelais } from "@/lib/textos/relais";
import { numerosSuivis } from "@/lib/textos/reponses";

export const dynamic = "force-dynamic";

// Le relais Mac demande quels numéros surveiller : seules les réponses de
// ces numéros sont lues dans l'app Messages et remontées au site.
export async function POST(request: Request) {
  const profileId = await profilDuRelais(request);
  if (!profileId) return NextResponse.json({ error: "Clé du relais invalide." }, { status: 401 });
  const suivis = await numerosSuivis(profileId);
  return NextResponse.json({ numeros: Array.from(suivis.keys()) });
}
