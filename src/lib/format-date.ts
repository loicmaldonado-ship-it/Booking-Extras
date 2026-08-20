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
