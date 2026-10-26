export type Guardian = { prenom: string; nom: string; adresse: string; telephone: string; email: string };
export type GuardianAbsence = { absence_reason: "decede" | "sans_autorite" };
export type GuardiansData = { first: Guardian; second: Guardian | GuardianAbsence };

export function todayInParis(now = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function ageOnDate(birth: string | null | undefined, reference = todayInParis()): number | null {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const parsed = new Date(birth + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birth || birth > reference) return null;
  const years = Number(reference.slice(0, 4)) - Number(birth.slice(0, 4)) - (reference.slice(5) < birth.slice(5) ? 1 : 0);
  return years >= 0 && years <= 120 ? years : null;
}

export function readGuardians(fd: FormData, birth: string, childEmail: string, reference = todayInParis()): { data: GuardiansData | null } | { error: string } {
  const age = ageOnDate(birth, reference);
  if (age === null) return { error: "Date de naissance invalide." };
  if (age >= 18) return { data: null };
  const read = (position: number): Guardian | { error: string } => {
    const get = (name: string) => String(fd.get(`guardian_${position}_${name}`) ?? "").trim();
    const data = { prenom: get("prenom"), nom: get("nom"), adresse: get("adresse"), telephone: get("telephone"), email: get("email").toLowerCase() };
    if (!data.prenom || !data.nom || !data.adresse || !data.telephone || !data.email) return { error: `Complète les coordonnées du représentant légal ${position}.` };
    if (data.prenom.length > 120 || data.nom.length > 120 || data.adresse.length > 1000 || data.telephone.length > 64 || data.email.length > 254) return { error: `Les coordonnées du représentant légal ${position} sont trop longues.` };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: `Email du représentant légal ${position} invalide.` };
    if (!/^[+\d(][\d\s().-]+$/.test(data.telephone) || data.telephone.replace(/\D/g, "").length < 6) return { error: `Téléphone du représentant légal ${position} invalide.` };
    return data;
  };
  const first = read(1);
  if ("error" in first) return first;
  const reason = String(fd.get("guardian_2_absence_reason") ?? "");
  if (reason && reason !== "decede" && reason !== "sans_autorite") return { error: "Le motif d'absence du second représentant est invalide." };
  const second = reason ? { absence_reason: reason as GuardianAbsence["absence_reason"] } : read(2);
  if ("error" in second) return second;
  const child = childEmail.trim().toLowerCase();
  if (first.email === child || (!("absence_reason" in second) && (second.email === child || second.email === first.email))) return { error: "L’enfant et chaque représentant légal doivent avoir des adresses email différentes." };
  return { data: { first, second } };
}
