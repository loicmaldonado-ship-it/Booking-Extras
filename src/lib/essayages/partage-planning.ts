export type PartageEssayageRow = {
  id: string;
  numero: number;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  statut: string;
  notes: string | null;
  numero_costume: string | null;
  creneau_id: string | null;
  figurants: { id: string; prenom: string; nom: string } | null;
};

export type Creneau = { heure_debut: string; heure_fin: string };

export function heureLabel(h: string) {
  return h.slice(0, 5);
}

export function effectiveHeure(e: PartageEssayageRow, creneauById: Map<string, Creneau>) {
  if (e.creneau_id && creneauById.has(e.creneau_id)) return creneauById.get(e.creneau_id)!.heure_debut;
  return e.heure;
}

export function slotLabel(e: PartageEssayageRow, creneauById: Map<string, Creneau>) {
  if (e.creneau_id && creneauById.has(e.creneau_id)) {
    const c = creneauById.get(e.creneau_id)!;
    return `${heureLabel(c.heure_debut)}–${heureLabel(c.heure_fin)}`;
  }
  return e.heure ? heureLabel(e.heure) : "Heure non renseignée";
}

export type SlotItem = { row: PartageEssayageRow; slotLabel: string; showSlotHeader: boolean; slotNumber: number };

// Trie les essayages d'une journée par heure d'arrivée et repère les
// changements de créneau, pour numéroter "Créneau 1", "Créneau 2"... — même
// logique utilisée par le planning en ligne et sa version imprimable.
export function buildSlotItems(rows: PartageEssayageRow[], creneauById: Map<string, Creneau>): SlotItem[] {
  const sorted = [...rows].sort(
    (a, b) => (effectiveHeure(a, creneauById) ?? "").localeCompare(effectiveHeure(b, creneauById) ?? "")
  );
  let slotNumber = 0;
  let lastLabel: string | null = null;
  return sorted.map((row) => {
    const label = slotLabel(row, creneauById);
    const showSlotHeader = label !== lastLabel;
    if (showSlotHeader) slotNumber += 1;
    lastLabel = label;
    return { row, slotLabel: label, showSlotHeader, slotNumber };
  });
}
