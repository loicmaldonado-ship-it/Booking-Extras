import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PossibleDuplicate = {
  figurant: { id: string; prenom: string; nom: string; email: string | null; telephone: string | null; ville: string | null };
  reason: "telephone" | "date_naissance_nom";
};

function normalizeTelephone(tel: string | null) {
  return tel ? tel.replace(/\s+/g, "") : null;
}

const DIACRITICS = /[̀-ͯ]/g;

function normalizeNom(nom: string) {
  return nom.trim().toLowerCase().normalize("NFD").replace(DIACRITICS, "");
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Pas une correspondance exacte (déjà gérée à la candidature par email ou
// nom+tél) — juste "assez proche pour valoir un coup d'œil" : même chaîne
// une fois les accents retirés, l'une contenant l'autre, ou à 2 lettres
// d'écart (variante orthographique, nom de scène qui garde le prénom...).
function nomsProches(a: string, b: string): boolean {
  const na = normalizeNom(a);
  const nb = normalizeNom(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 2 && nb.length > 2 && (na.includes(nb) || nb.includes(na))) return true;
  return levenshtein(na, nb) <= 2;
}

// Doublons "possibles" à faire valider par un humain — à ne jamais fusionner
// automatiquement, contrairement au rapprochement par email/nom+tél exact
// déjà fait à la candidature (voir postulerAnnonce).
export async function findPossibleDuplicates(figurantId: string): Promise<PossibleDuplicate[]> {
  const supabase = createAdminClient();
  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, nom, telephone, date_naissance")
    .eq("id", figurantId)
    .single();
  if (!figurant) return [];

  const results = new Map<string, PossibleDuplicate>();

  const tel = normalizeTelephone(figurant.telephone);
  if (tel) {
    const { data: candidats } = await supabase
      .from("figurants")
      .select("id, prenom, nom, email, telephone, ville")
      .neq("id", figurantId)
      .not("telephone", "is", null);
    for (const c of candidats ?? []) {
      if (normalizeTelephone(c.telephone) === tel) {
        results.set(c.id, { figurant: c, reason: "telephone" });
      }
    }
  }

  if (figurant.date_naissance) {
    const { data: candidats } = await supabase
      .from("figurants")
      .select("id, prenom, nom, email, telephone, ville")
      .neq("id", figurantId)
      .eq("date_naissance", figurant.date_naissance);
    for (const c of candidats ?? []) {
      if (!results.has(c.id) && nomsProches(`${c.prenom} ${c.nom}`, `${figurant.prenom} ${figurant.nom}`)) {
        results.set(c.id, { figurant: c, reason: "date_naissance_nom" });
      }
    }
  }

  return Array.from(results.values());
}
