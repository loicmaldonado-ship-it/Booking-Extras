"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import type { AppNotification, CandidatureATrier, NotificationGroup, NotificationType } from "./types";

const RECENT_LIMIT = 150;

// Chaque équipe (les membres d'un projet) voit les événements de ses
// projets, et un "lu" vaut pour toute l'équipe — voir
// 20260924000002_notifications_par_equipe. Seuls restent visibles par tout
// le monde les rares événements sans aucun projet.
function visibleToProfileFilter(accessibleIds: string[]) {
  return `projet_id.is.null,projet_id.in.(${idsOrNone(accessibleIds).join(",")})`;
}

function plural(n: number, singulier: string, pluriel: string) {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

function groupTitre(type: NotificationType, count: number, nonLu: boolean, contexte: string | null) {
  const suffixe = contexte ? ` · « ${contexte} »` : "";
  if (type === "candidature") {
    return (nonLu ? plural(count, "nouvelle candidature", "nouvelles candidatures") : plural(count, "candidature", "candidatures")) + suffixe;
  }
  if (type === "casting") return plural(count, "envoi de casting", "envois de casting") + suffixe;
  if (type === "compte_cree") return plural(count, "compte candidat créé", "comptes candidat créés") + suffixe;
  return plural(count, "réponse", "réponses") + suffixe;
}

// Regroupe par type + annonce (candidatures) ou projet (le reste), sans
// jamais mêler non lus et lus. Un groupe d'un seul événement garde son
// titre et son lien d'origine.
function buildGroups(
  notifs: AppNotification[],
  annonceTitres: Map<string, string>,
  projetNoms: Map<string, string>
): NotificationGroup[] {
  const map = new Map<string, AppNotification[]>();
  for (const n of notifs) {
    const contexte = n.type === "candidature" && n.annonce_id ? `a:${n.annonce_id}` : `p:${n.projet_id ?? "global"}`;
    const key = `${n.type}|${contexte}|${n.lu_at ? "lu" : "nonlu"}`;
    const list = map.get(key) ?? [];
    list.push(n);
    map.set(key, list);
  }

  const groups: NotificationGroup[] = [];
  for (const [key, items] of map) {
    const first = items[0];
    const nonLu = !first.lu_at;
    if (items.length === 1) {
      groups.push({ key, type: first.type, titre: first.titre, lien: first.lien, nonLu, latestAt: first.created_at, items });
      continue;
    }
    const contexte =
      first.type === "candidature" && first.annonce_id
        ? (annonceTitres.get(first.annonce_id) ?? null)
        : first.projet_id
          ? (projetNoms.get(first.projet_id) ?? null)
          : null;
    const lien =
      first.type === "candidature" && first.annonce_id
        ? `/candidatures?annonce_id=${first.annonce_id}${nonLu ? "&onglet_id=a_trier" : ""}`
        : first.type === "casting"
          ? "/casting"
          : null;
    groups.push({
      key,
      type: first.type,
      titre: groupTitre(first.type, items.length, nonLu, contexte),
      lien,
      nonLu,
      latestAt: first.created_at,
      items,
    });
  }

  return groups.sort((a, b) => Number(b.nonLu) - Number(a.nonLu) || b.latestAt.localeCompare(a.latestAt));
}

export async function getNotificationsPanel(): Promise<{
  groups: NotificationGroup[];
  unreadCount: number;
  aTrier: CandidatureATrier[];
}> {
  const profile = await getCurrentProfile();
  if (!profile) return { groups: [], unreadCount: 0, aTrier: [] };

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

  const list = notifs ?? [];
  const annonceIds = Array.from(new Set(list.map((n) => n.annonce_id).filter((id): id is string => !!id)));
  const projetIds = Array.from(new Set(list.map((n) => n.projet_id).filter((id): id is string => !!id)));
  const [{ data: annonces }, { data: projets }] = await Promise.all([
    annonceIds.length > 0
      ? supabase.from("annonces").select("id, titre").in("id", annonceIds)
      : Promise.resolve({ data: [] as { id: string; titre: string }[] }),
    projetIds.length > 0
      ? supabase.from("projets").select("id, nom").in("id", projetIds)
      : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
  ]);

  return {
    groups: buildGroups(
      list,
      new Map((annonces ?? []).map((a) => [a.id, a.titre])),
      new Map((projets ?? []).map((p) => [p.id, p.nom]))
    ),
    unreadCount: unreadCount ?? 0,
    aTrier,
  };
}

// Ne marque que ce que l'équipe de la personne voit réellement : un id
// d'un autre projet passé à la main est simplement ignoré.
export async function markNotificationsLues(ids: string[]) {
  const profile = await getCurrentProfile();
  if (!profile || ids.length === 0) return;

  const supabase = createAdminClient();
  const accessibleIds = (await getAccessibleProjetIds(profile)) ?? [];
  await supabase
    .from("notifications")
    .update({ lu_at: new Date().toISOString() })
    .in("id", ids)
    .is("lu_at", null)
    .or(visibleToProfileFilter(accessibleIds));
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
