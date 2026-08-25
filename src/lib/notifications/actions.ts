"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, checkProjetAccess, idsOrNone } from "@/lib/auth/session";
import type { AppNotification, CandidatureATrier } from "./types";

const RECENT_LIMIT = 40;

// Un événement sans projet (réponse à un message, compte candidat créé)
// porte sur une fiche figurant partagée entre toutes les chef·fes — il
// reste visible par tout le monde, comme la fiche elle-même. Un événement
// avec projet (candidature, casting) est privé à ce projet : seul·es les
// membres de son équipe le voient — voir 20260906000001_notif_projet_scope.
function visibleToProfileFilter(accessibleIds: string[]) {
  return `projet_id.is.null,projet_id.in.(${idsOrNone(accessibleIds).join(",")})`;
}

export async function getNotificationsPanel(): Promise<{
  notifications: AppNotification[];
  unreadCount: number;
  aTrier: CandidatureATrier[];
}> {
  const profile = await getCurrentProfile();
  if (!profile) return { notifications: [], unreadCount: 0, aTrier: [] };

  const supabase = createAdminClient();
  const accessibleIds = (await getAccessibleProjetIds(profile)) ?? [];
  const visibleFilter = visibleToProfileFilter(accessibleIds);

  const [{ data: notifs }, { count: unreadCount }, { data: annoncesOuvertes }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .or(visibleFilter)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT)
      .returns<AppNotification[]>(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("lu_at", null).or(visibleFilter),
    supabase.from("annonces").select("id, titre").eq("statut", "ouverte").in("projet_id", idsOrNone(accessibleIds)),
  ]);

  let aTrier: CandidatureATrier[] = [];
  const openIds = (annoncesOuvertes ?? []).map((a) => a.id);
  if (openIds.length > 0) {
    const [{ data: candidaturesRaw }, { data: bookedCandidatures }] = await Promise.all([
      supabase.from("candidatures").select("id, annonce_id").is("onglet_id", null).in("annonce_id", openIds),
      supabase.from("bookings").select("candidature_id").not("candidature_id", "is", null),
    ]);

    // Une candidature déjà ajoutée à un booking n'a plus besoin d'être
    // triée — même logique que la page /candidatures, sinon le chiffre
    // affiché ici ne correspond à rien d'actionnable.
    const bookedIds = new Set((bookedCandidatures ?? []).map((b) => b.candidature_id));
    const counts = new Map<string, number>();
    for (const c of candidaturesRaw ?? []) {
      if (bookedIds.has(c.id)) continue;
      counts.set(c.annonce_id, (counts.get(c.annonce_id) ?? 0) + 1);
    }

    aTrier = (annoncesOuvertes ?? [])
      .filter((a) => counts.has(a.id))
      .map((a) => ({ annonce_id: a.id, annonce_titre: a.titre, count: counts.get(a.id)! }));
  }

  return { notifications: notifs ?? [], unreadCount: unreadCount ?? 0, aTrier };
}

export async function markNotificationLu(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = createAdminClient();
  const { data: notif } = await supabase.from("notifications").select("projet_id").eq("id", id).maybeSingle();
  if (!notif) return;
  if (await checkProjetAccess(notif.projet_id)) return;

  await supabase.from("notifications").update({ lu_at: new Date().toISOString() }).eq("id", id);
}

export async function markAllNotificationsLues() {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = createAdminClient();
  const accessibleIds = (await getAccessibleProjetIds(profile)) ?? [];
  await supabase
    .from("notifications")
    .update({ lu_at: new Date().toISOString() })
    .is("lu_at", null)
    .or(visibleToProfileFilter(accessibleIds));
}
