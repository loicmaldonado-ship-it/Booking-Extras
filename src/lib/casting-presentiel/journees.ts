import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateLong } from "@/lib/format-date";

export type PresentielJournee = {
  id: string;
  projet_id: string;
  date: string;
  lieu: string | null;
  numero: number;
  total: number;
  confirmes: number;
  valides: number;
};

export type PresentielJourneeAvecCreneaux = {
  id: string;
  date: string;
  creneaux: { id: string; heure_debut: string; heure_fin: string }[];
};

// Version légère (pas de comptage bookings) pour le panneau "Envoyer au
// planning présentiel" depuis /casting — juste de quoi peupler les deux
// menus déroulants journée puis créneau.
export async function getPresentielJourneesWithCreneaux(projetId: string): Promise<PresentielJourneeAvecCreneaux[]> {
  const supabase = createAdminClient();
  const { data: journees } = await supabase
    .from("casting_presentiel_journees")
    .select("id, date")
    .eq("projet_id", projetId)
    .order("date", { ascending: true });
  if (!journees || journees.length === 0) return [];

  const { data: creneaux } = await supabase
    .from("casting_presentiel_creneaux")
    .select("id, journee_id, heure_debut, heure_fin")
    .in("journee_id", journees.map((j) => j.id))
    .order("heure_debut")
    .returns<{ id: string; journee_id: string; heure_debut: string; heure_fin: string }[]>();

  const creneauxByJournee = new Map<string, { id: string; heure_debut: string; heure_fin: string }[]>();
  for (const c of creneaux ?? []) {
    const list = creneauxByJournee.get(c.journee_id) ?? [];
    list.push({ id: c.id, heure_debut: c.heure_debut, heure_fin: c.heure_fin });
    creneauxByJournee.set(c.journee_id, list);
  }

  return journees.map((j) => ({ id: j.id, date: j.date, creneaux: creneauxByJournee.get(j.id) ?? [] }));
}

export type PresentielAssignment = { lieu: string | null; dateLabel: string; heureLabel: string | null };

// Pour le composeur de la page Casting (rôles) : retrouve, pour chaque
// profil d'un rôle, où et quand son casting présentiel est programmé — afin
// de remplir {lieu} et {horaire} sans repasser par la page de la journée.
// Un seul aller-retour pour tout le projet plutôt qu'une requête par rôle.
export async function getPresentielAssignmentsByRole(
  projetId: string
): Promise<Map<string, Map<string, PresentielAssignment>>> {
  const supabase = createAdminClient();
  const { data: entries } = await supabase
    .from("casting_presentiel_entries")
    .select("figurant_id, role_id, journee_id, creneau_id")
    .eq("projet_id", projetId)
    .not("role_id", "is", null)
    .returns<{ figurant_id: string; role_id: string; journee_id: string; creneau_id: string | null }[]>();
  if (!entries || entries.length === 0) return new Map();

  const journeeIds = Array.from(new Set(entries.map((e) => e.journee_id)));
  const creneauIds = Array.from(new Set(entries.map((e) => e.creneau_id).filter((id): id is string => !!id)));

  const [{ data: journees }, { data: creneaux }] = await Promise.all([
    supabase.from("casting_presentiel_journees").select("id, date, lieu").in("id", journeeIds),
    creneauIds.length > 0
      ? supabase.from("casting_presentiel_creneaux").select("id, heure_debut, heure_fin").in("id", creneauIds)
      : Promise.resolve({ data: [] as { id: string; heure_debut: string; heure_fin: string }[] }),
  ]);

  const journeeById = new Map((journees ?? []).map((j) => [j.id, j]));
  const creneauById = new Map((creneaux ?? []).map((c) => [c.id, c]));

  const byRole = new Map<string, Map<string, PresentielAssignment>>();
  for (const e of entries) {
    const journee = journeeById.get(e.journee_id);
    if (!journee) continue;
    const creneau = e.creneau_id ? creneauById.get(e.creneau_id) : null;
    const roleMap = byRole.get(e.role_id) ?? new Map<string, PresentielAssignment>();
    roleMap.set(e.figurant_id, {
      lieu: journee.lieu,
      dateLabel: formatDateLong(journee.date),
      heureLabel: creneau ? `${creneau.heure_debut.slice(0, 5)} à ${creneau.heure_fin.slice(0, 5)}` : null,
    });
    byRole.set(e.role_id, roleMap);
  }
  return byRole;
}

export async function getPresentielJournees(projetId?: string): Promise<PresentielJournee[]> {
  const supabase = createAdminClient();

  let journeesQuery = supabase
    .from("casting_presentiel_journees")
    .select("id, projet_id, date, lieu")
    .order("date", { ascending: true });
  if (projetId) journeesQuery = journeesQuery.eq("projet_id", projetId);

  let entriesQuery = supabase.from("casting_presentiel_entries").select("journee_id, statut");
  if (projetId) entriesQuery = entriesQuery.eq("projet_id", projetId);

  const [{ data: journeesRaw }, { data: entriesRaw }] = await Promise.all([
    journeesQuery,
    entriesQuery.returns<{ journee_id: string; statut: string }[]>(),
  ]);

  const counts = new Map<string, { total: number; confirmes: number; valides: number }>();
  for (const e of entriesRaw ?? []) {
    const existing = counts.get(e.journee_id) ?? { total: 0, confirmes: 0, valides: 0 };
    existing.total += 1;
    if (e.statut === "confirmé") existing.confirmes += 1;
    if (e.statut === "valide") existing.valides += 1;
    counts.set(e.journee_id, existing);
  }

  return (journeesRaw ?? []).map((j, i) => {
    const c = counts.get(j.id) ?? { total: 0, confirmes: 0, valides: 0 };
    return {
      id: j.id,
      projet_id: j.projet_id,
      date: j.date,
      lieu: j.lieu,
      numero: i + 1,
      total: c.total,
      confirmes: c.confirmes,
      valides: c.valides,
    };
  });
}
