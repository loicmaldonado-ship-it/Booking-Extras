import type { JourCandidature } from "@/components/candidatures/jour-chips";

export type SelectionJours = { id: string; nom: string; jours: JourCandidature[] };

export function marquerJoursEnvoyes(selection: SelectionJours[], jourId: string, ids: string[]): SelectionJours[] {
  const envoyes = new Set(ids);
  return selection.map((personne) => envoyes.has(personne.id)
    ? { ...personne, jours: personne.jours.map((jour) => jour.id === jourId ? { ...jour, dansLaJournee: true } : jour) }
    : personne);
}

export function construireJoursReprise(
  dates: { id: string; date: string }[],
  disponibilites: ReadonlySet<string>,
  datesBookees: ReadonlySet<string>
): JourCandidature[] {
  return dates.map((date) => ({
    ...date,
    disponible: disponibilites.has(date.id),
    prevu: false,
    dansLaJournee: datesBookees.has(date.date),
  }));
}
