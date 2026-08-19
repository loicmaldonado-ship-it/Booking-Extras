import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

  const sessionToken = randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await supabase.from("figurant_sessions").insert({
    figurant_id: authToken.figurant_id,
    token: sessionToken,
    expires_at: expiresAt.toISOString(),
  });

  const response = NextResponse.redirect(`${origin}/compte`);
  response.cookies.set("figurant_session", sessionToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
  });
  return response;
}
