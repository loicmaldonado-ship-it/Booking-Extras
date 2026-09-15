"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SESSION_STARTED_AT_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-timeout";

export async function signIn(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }

  // Marque le début de session pour la déconnexion forcée au bout d'1h
  // (voir middleware.ts) — indépendant du rafraîchissement silencieux du
  // token Supabase, qui sinon garderait la session ouverte indéfiniment.
  const cookieStore = await cookies();
  cookieStore.set(SESSION_STARTED_AT_COOKIE, Date.now().toString(), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(next.startsWith("/") ? next : "/");
}

// Toujours le même message de succès, que l'email existe ou non côté
// Supabase Auth — ne jamais laisser deviner quels emails ont un compte.
export async function requestPasswordReset(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email requis." };

  const supabase = await createServerSupabaseClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Passe par /auth/confirm (échange du code PKCE côté serveur) plutôt que
  // directement vers la page du formulaire — voir route.ts pour le détail.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm`,
  });

  return { success: true };
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_STARTED_AT_COOKIE);
  redirect("/login");
}
