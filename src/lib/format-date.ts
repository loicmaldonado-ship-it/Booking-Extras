export function formatDateShort(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Pour les pastilles serrées (dispos par date sur une carte) : 08/10
export function formatDayMonth(date: string) {
  const [, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Garde le jour de la semaine (utile pour la logistique de tournage) mais la
// date elle-même reste toujours au format JJ/MM/AAAA, comme partout ailleurs
// dans l'app.
export function formatDateLong(date: string, locale: "fr-FR" | "en-US" = "fr-FR") {
  const d = new Date(`${date}T00:00:00`);
  const weekday = capitalize(d.toLocaleDateString(locale, { weekday: "long" }));
  return `${weekday} ${formatDateShort(date)}`;
}

// Libellé "Dates : ..." d'une annonce — les dates de tournage précises si
// elles sont calibrées, sinon la date recherchée unique (souvent tout ce
// qu'on a au moment de la publication).
export function formatAnnonceDatesLabel(
  annonceDates: { date: string }[],
  dateRecherchee: string | null
): string | null {
  if (annonceDates.length > 0) {
    // Jours qui se suivent (période de tournage) : « du 20/10/2026 au
    // 20/11/2026 » plutôt que la liste de toutes les dates.
    const triees = Array.from(new Set(annonceDates.map((d) => d.date.slice(0, 10)))).sort();
    const suites: string[][] = [];
    for (const date of triees) {
      const derniere = suites[suites.length - 1];
      const veille = derniere ? new Date(`${derniere[derniere.length - 1]}T12:00:00Z`) : null;
      if (veille) veille.setUTCDate(veille.getUTCDate() + 1);
      if (derniere && veille && veille.toISOString().slice(0, 10) === date) derniere.push(date);
      else suites.push([date]);
    }
    return suites
      .map((suite) =>
        suite.length >= 3
          ? `du ${formatDateShort(suite[0])} au ${formatDateShort(suite[suite.length - 1])}`
          : suite.map(formatDateShort).join(", ")
      )
      .join(", ");
  }
  return dateRecherchee ? formatDateShort(dateRecherchee) : null;
}

export function formatDateTime(iso: string) {
  const time = new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${formatDateShort(iso)} ${time}`;
}

// Les convocations partent en général la veille du tournage : l'unité utile
// est la minute puis l'heure, pas le jour (sauf cas très en retard, en
// dépannage).
export function formatDelai(fromIso: string, toIso: string): string {
  const ms = Math.max(0, new Date(toIso).getTime() - new Date(fromIso).getTime());
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 48) return remMin > 0 ? `${hours}h${String(remMin).padStart(2, "0")}` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} j`;
}
