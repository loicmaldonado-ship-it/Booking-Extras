export function formatDateShort(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Garde le jour de la semaine (utile pour la logistique de tournage) mais la
// date elle-même reste toujours au format JJ/MM/AAAA, comme partout ailleurs
// dans l'app.
export function formatDateLong(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const weekday = capitalize(d.toLocaleDateString("fr-FR", { weekday: "long" }));
  return `${weekday} ${formatDateShort(date)}`;
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
