import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFigurantSession } from "@/lib/candidats/session";
import { retourAutorise } from "@/lib/candidats/retour";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const origin = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/compte/connexion`);
  }

  const supabase = createAdminClient();
  const { data: authToken } = await supabase
    .from("figurant_auth_tokens")
    .select("id, figurant_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!authToken || authToken.used_at || new Date(authToken.expires_at) < new Date()) {
    const url = new URL("/compte/connexion", origin);
    url.searchParams.set("error", "lien_invalide");
    return NextResponse.redirect(url);
  }

  await supabase.from("figurant_auth_tokens").update({ used_at: new Date().toISOString() }).eq("id", authToken.id);
  await createFigurantSession(authToken.figurant_id);

  // Connexion demandée depuis une annonce : retour direct sur le formulaire,
  // pré-rempli.
  const retour = retourAutorise(request.nextUrl.searchParams.get("retour"));
  return NextResponse.redirect(`${origin}${retour ?? "/compte"}`);
}
