import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Échange le `code` PKCE reçu par email CÔTÉ SERVEUR, jamais côté
// navigateur : le vérificateur PKCE correspondant a été stocké dans un
// cookie au moment de l'appel serveur à resetPasswordForEmail
// (src/lib/auth/actions.ts) — seul un client qui lit ce même cookie peut
// terminer l'échange. Un exchangeCodeForSession() côté navigateur ne le
// retrouve pas (stockage différent) et échoue avec
// AuthPKCECodeVerifierMissingError, quel que soit le contenu du lien.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const redirectTo = request.nextUrl.searchParams.get("redirect_to") ?? "/auth/reset-password";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/reset-password?error=1", request.url));
}
