"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";

// Lien spécial agent — côté agent (aucun compte : le lien fait foi). Tout est
// revérifié ici à chaque appel : lien actif, rôle ouvert aux agents du même
// projet, date limite, taille et type des photos. Un agent n'accède jamais aux
// propositions d'un autre : toute lecture ou écriture passe par SON agent_id.

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "agent-propositions";
const MAX_PHOTOS = 8;
const MAX_OCTETS_PHOTO = 8 * 1024 * 1024;
const MAX_PAR_JOUR = 60;
const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

async function agentActif(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await createAdminClient()
    .from("casting_agents")
    .select("id, projet_id, nom, agence, actif")
    .eq("token", token)
    .maybeSingle();
  return data?.actif ? data : null;
}

// Seuls http(s) sont acceptés pour les liens (jamais javascript: ou autre).
function lienPropre(v: string): string | null | "invalide" {
  const t = v.trim();
  if (!t) return null;
  const avecProtocole = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(avecProtocole);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return "invalide";
    return u.toString().slice(0, 400);
  } catch {
    return "invalide";
  }
}

export async function creerProposition(
  token: string,
  roleId: string,
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  const agent = await agentActif(token);
  if (!agent) return { error: "Ce lien n'est plus actif." };

  const champ = (k: string, max: number) => String(formData.get(k) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const prenom = champ("prenom", 60);
  const nom = champ("nom", 60);
  if (!prenom || !nom) return { error: "Indique le prénom et le nom." };
  const lienPage = lienPropre(String(formData.get("lien_page") ?? ""));
  const lienDemo = lienPropre(String(formData.get("lien_bande_demo") ?? ""));
  if (lienPage === "invalide") return { error: "Le lien vers la page du comédien n'est pas valide." };
  if (lienDemo === "invalide") return { error: "Le lien vers la bande démo n'est pas valide." };

  const supabase = createAdminClient();
  const { data: role } = await supabase
    .from("casting_roles")
    .select("id, nom, projet_id, ouvert_agents, date_limite_envoi")
    .eq("id", roleId)
    .eq("projet_id", agent.projet_id)
    .maybeSingle();
  if (!role || !role.ouvert_agents) return { error: "Ce rôle n'est plus ouvert aux propositions." };
  if (role.date_limite_envoi && role.date_limite_envoi < new Date().toISOString().slice(0, 10)) {
    return { error: "La date limite des propositions est passée." };
  }

  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("casting_propositions_agents")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .gte("created_at", depuis);
  if ((count ?? 0) >= MAX_PAR_JOUR) return { error: "Trop de propositions aujourd'hui. Réessaie demain ou contacte l'équipe." };

  const { data, error } = await supabase
    .from("casting_propositions_agents")
    .insert({
      projet_id: agent.projet_id,
      agent_id: agent.id,
      role_id: role.id,
      prenom,
      nom,
      age: champ("age", 30) || null,
      taille: champ("taille", 30) || null,
      lien_page: lienPage,
      lien_bande_demo: lienDemo,
      note: String(formData.get("note") ?? "").trim().slice(0, 1500) || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Envoi impossible, réessaie." };

  await createNotification("casting", `🤝 ${agent.nom} propose ${prenom} ${nom} pour « ${role.nom} »`, {
    projetId: agent.projet_id,
    lien: "/casting/agents",
  });
  return { id: data.id };
}

// Une photo à la fois (chaque envoi reste sous la limite de taille des fonctions).
export async function ajouterPhotoProposition(
  token: string,
  propositionId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const agent = await agentActif(token);
  if (!agent) return { error: "Ce lien n'est plus actif." };
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choisis une image." };
  if (!TYPES_IMAGE.includes(photo.type)) return { error: "Format d'image non pris en charge." };
  if (photo.size > MAX_OCTETS_PHOTO) return { error: "Photo trop lourde (8 Mo maximum)." };

  const supabase = createAdminClient();
  const { data: prop } = await supabase
    .from("casting_propositions_agents")
    .select("id, photos, statut, created_at")
    .eq("id", propositionId)
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (!prop || prop.statut !== "en_attente") return { error: "Proposition introuvable." };
  // Les photos se joignent juste après l'envoi du formulaire, pas des heures plus tard.
  if (Date.now() - new Date(prop.created_at).getTime() > 2 * 3600 * 1000) return { error: "Délai dépassé pour ajouter des photos." };
  if ((prop.photos as string[]).length >= MAX_PHOTOS) return { error: `${MAX_PHOTOS} photos au maximum.` };

  const ext = (photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  const chemin = `${agent.projet_id}/${propositionId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(chemin, photo, { contentType: photo.type, upsert: false });
  if (uploadError) return { error: "Photo non enregistrée, réessaie." };

  const { error } = await supabase
    .from("casting_propositions_agents")
    .update({ photos: [...(prop.photos as string[]), chemin] })
    .eq("id", propositionId)
    .eq("agent_id", agent.id);
  if (error) {
    await supabase.storage.from(BUCKET).remove([chemin]);
    return { error: "Photo non enregistrée, réessaie." };
  }
  return {};
}
