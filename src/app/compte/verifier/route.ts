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
    // Un lien « Crée ton compte » ne connecte jamais directement.
    .eq("objet", "connexion")
    .maybeSingle();

  if (!authToken || authToken.used_at || new Date(authToken.expires_at) < new Date()) {
    const url = new URL("/compte/connexion", origin);
    url.searchParams.set("error", "lien_invalide");
    return NextResponse.redirect(url);
  }

  const { data: figurant, error: compteError } = await supabase
    .from("figurants")
    .select("acces_compte")
    .eq("id", authToken.figurant_id)
    .maybeSingle();
  if (compteError || !figurant?.acces_compte) {
    return NextResponse.redirect(`${origin}/compte/connexion?error=acces_desactive`);
  }

  // Compare-and-set avoids redeeming the same link twice in concurrent requests.
  const { data: redeemed, error: redeemError } = await supabase
    .from("figurant_auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", authToken.id)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (redeemError || !redeemed) {
    return NextResponse.redirect(`${origin}/compte/connexion?error=lien_invalide`);
  }
  await createFigurantSession(authToken.figurant_id);

  // Connexion demandée depuis une annonce : retour direct sur le formulaire,
  // pré-rempli.
  const retour = retourAutorise(request.nextUrl.searchParams.get("retour"));
  return NextResponse.redirect(`${origin}${retour ?? "/compte"}`);
}
