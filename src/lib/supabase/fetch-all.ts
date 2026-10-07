// Supabase (PostgREST) renvoie au plus 1000 lignes par requête, sans
// erreur : au-delà, les lignes manquent en silence. Sur l'annonce « Série
// Britannique » (1310 disponibilités), tous les candidat·es au-delà des
// 1000 premières réponses apparaissaient « pas dispo ». À utiliser pour
// toute requête qui peut grossir avec le nombre de candidatures.
//
// La requête doit avoir un ordre stable (clé unique en dernier), sinon des
// lignes peuvent sauter ou se répéter d'un paquet à l'autre.
const PAQUET = 1000;

export async function fetchAll<T>(
  paquet: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const lignes: T[] = [];
  for (let from = 0; ; from += PAQUET) {
    const { data, error } = await paquet(from, from + PAQUET - 1);
    if (error) return { data: lignes, error };
    lignes.push(...(data ?? []));
    if (!data || data.length < PAQUET) return { data: lignes, error: null };
  }
}
