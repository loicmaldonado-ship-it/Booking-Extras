import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CurrentProfile = {
  id: string;
  email: string | null;
  nom: string | null;
  role: "chef" | "assistant";
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nom, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: user.email ?? null,
    nom: profile.nom,
    role: profile.role as "chef" | "assistant",
  };
}

// Returns null for a chef (unrestricted — full access) or the list of
// projet ids an assistant has been invited to (possibly empty).
export async function getAccessibleProjetIds(profile: CurrentProfile): Promise<string[] | null> {
  if (profile.role === "chef") return null;

  const admin = createAdminClient();
  const { data } = await admin.from("projet_membres").select("projet_id").eq("profile_id", profile.id);
  return (data ?? []).map((r) => r.projet_id);
}

// Safe to spread into a Supabase `.in("id", ...)` filter even when the list
// is empty — an empty `.in()` would otherwise match nothing predictably
// across drivers, so this guarantees a no-match sentinel instead.
export function idsOrNone(ids: string[]) {
  return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}
