"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, SUPPORT_COOKIE } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";

// Mode support : le compte propriétaire voit le site comme une autre
// cheffe (ses projets à elle dans tous les menus et listes), avec un
// bandeau sur chaque page. Son propre projet en cours est mis de côté et
// rendu à la sortie, pour ne jamais mélanger les deux espaces.
const PROJET_COOKIE = "current_projet_id";
const RETOUR_COOKIE = "support_retour_projet_id";
const DUREE = 60 * 60 * 8; // une journée de travail, puis retour automatique à son espace

export async function entrerModeSupport(chefId: string, projetId?: string) {
  const profile = await getCurrentProfile();
  if (!isOwner(profile)) throw new Error("Réservé au compte propriétaire.");

  const admin = createAdminClient();
  const { data: chef } = await admin.from("profiles").select("id, role").eq("id", chefId).maybeSingle();
  if (!chef || chef.role !== "chef" || chef.id === profile!.id) throw new Error("Cheffe introuvable.");

  let projetActif = projetId ?? null;
  if (projetActif) {
    const { data: projet } = await admin.from("projets").select("owner_id").eq("id", projetActif).maybeSingle();
    if (projet?.owner_id !== chefId) projetActif = null;
  }
  if (!projetActif) {
    const { data: recent } = await admin
      .from("projets")
      .select("id")
      .eq("owner_id", chefId)
      .eq("archive", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    projetActif = recent?.id ?? null;
  }

  const store = await cookies();
  const dejaEnSupport = !!store.get(SUPPORT_COOKIE)?.value;
  if (!dejaEnSupport) {
    const monProjet = store.get(PROJET_COOKIE)?.value;
    if (monProjet) store.set(RETOUR_COOKIE, monProjet, { path: "/", maxAge: DUREE, httpOnly: true, sameSite: "lax" });
    else store.delete(RETOUR_COOKIE);
  }
  store.set(SUPPORT_COOKIE, chefId, { path: "/", maxAge: DUREE, httpOnly: true, sameSite: "lax" });
  // Même durée que le mode support : s'il expire, le projet de la cheffe ne
  // reste pas « en cours » dans l'espace du compte propriétaire.
  if (projetActif) store.set(PROJET_COOKIE, projetActif, { path: "/", maxAge: DUREE });
  else store.delete(PROJET_COOKIE);

  redirect(projetId ? "/bookings" : "/");
}

export async function quitterModeSupport() {
  const store = await cookies();
  const retour = store.get(RETOUR_COOKIE)?.value;
  store.delete(SUPPORT_COOKIE);
  store.delete(RETOUR_COOKIE);
  if (retour) store.set(PROJET_COOKIE, retour, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  else store.delete(PROJET_COOKIE);
  redirect("/admin/support");
}
