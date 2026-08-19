export function formatDateShort(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateLong(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const weekday = capitalize(d.toLocaleDateString("fr-FR", { weekday: "long" }));
  const month = capitalize(d.toLocaleDateString("fr-FR", { month: "long" }));
  return `${weekday} ${d.getDate()} ${month} ${d.getFullYear()}`;
}
