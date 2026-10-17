"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";

// Dernier message envoyé par la personne connectée à cet endroit
// (« journee-libre », « casting:<rôle> », « candidatures »…).
export async function lireDernierMessage(contexte: string): Promise<{ sujet: string | null; corps: string } | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const { data } = await createAdminClient()
    .from("derniers_messages")
    .select("sujet, corps")
    .eq("profile_id", profile.id)
    .eq("contexte", contexte.slice(0, 100))
    .maybeSingle();
  return data ?? null;
}

export async function enregistrerDernierMessage(contexte: string, sujet: string | null, corps: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || !corps.trim()) return;
  await createAdminClient()
    .from("derniers_messages")
    .upsert(
      {
        profile_id: profile.id,
        contexte: contexte.slice(0, 100),
        sujet: sujet?.slice(0, 300) ?? null,
        corps: corps.slice(0, 5000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,contexte" }
    );
}
