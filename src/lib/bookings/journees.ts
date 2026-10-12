import { fetchAll } from "@/lib/supabase/fetch-all";
import { createAdminClient } from "@/lib/supabase/admin";

export type Journee = {
  id: string;
  projet_id: string;
  date: string;
  numero: number;
  total: number;
  actifs: number;
  confirmes: number;
  per: number;
  hommes: number;
  femmes: number;
  nonBinaires: number;
  total_requis: number | null;
  lieu: string | null;
  convocation_precisions: string | null;
  convocation_hmc: string | null;
  convocation_accessoires: string | null;
  convocation_commentaires: string | null;
  // Journée basculée par une modification du PDT : date de destination.
  pdt_vers: string | null;
};

const STATUTS_ARCHIVES = new Set(["annulé", "indisponible"]);

export async function getJournees(projetId?: string): Promise<Journee[]> {
  const supabase = createAdminClient();

  let journeesQuery = supabase
    .from("journees")
    .select(
      "id, projet_id, date, total_requis, lieu, convocation_precisions, convocation_hmc, convocation_accessoires, convocation_commentaires, pdt_vers"
    )
    .order("date", { ascending: true });
  if (projetId) journeesQuery = journeesQuery.eq("projet_id", projetId);

  // Plus de 1000 bookings sur un projet (ex. 200 profils × 10 jours) :
  // PostgREST tronquerait les compteurs en silence.
  const lireBookings = (from: number, to: number) => {
    let q = supabase.from("bookings").select("projet_id, date, statut, figurants!bookings_figurant_id_fkey(genre)");
    if (projetId) q = q.eq("projet_id", projetId);
    return q
      .order("id")
      .range(from, to)
      .returns<{ projet_id: string; date: string; statut: string; figurants: { genre: string | null } | null }[]>();
  };

  const [{ data: journeesRaw }, { data: bookingsRaw }] = await Promise.all([journeesQuery, fetchAll(lireBookings)]);

  const counts = new Map<
    string,
    { total: number; actifs: number; confirmes: number; per: number; hommes: number; femmes: number; nonBinaires: number }
  >();
  for (const b of bookingsRaw ?? []) {
    const key = `${b.projet_id}::${b.date}`;
    const existing =
      counts.get(key) ?? { total: 0, actifs: 0, confirmes: 0, per: 0, hommes: 0, femmes: 0, nonBinaires: 0 };
    existing.total += 1;
    if (!STATUTS_ARCHIVES.has(b.statut)) existing.actifs += 1;
    if (b.statut === "confirmé") existing.confirmes += 1;
    if (b.statut === "envoyé") existing.per += 1;
    if (b.figurants?.genre === "Homme") existing.hommes += 1;
    if (b.figurants?.genre === "Femme") existing.femmes += 1;
    if (b.figurants?.genre === "Non-binaire") existing.nonBinaires += 1;
    counts.set(key, existing);
  }

  return (journeesRaw ?? []).map((j, i) => {
    const c = counts.get(`${j.projet_id}::${j.date}`) ?? {
      total: 0,
      actifs: 0,
      confirmes: 0,
      per: 0,
      hommes: 0,
      femmes: 0,
      nonBinaires: 0,
    };
    return {
      id: j.id,
      projet_id: j.projet_id,
      date: j.date,
      numero: i + 1,
      total: c.total,
      actifs: c.actifs,
      confirmes: c.confirmes,
      per: c.per,
      hommes: c.hommes,
      femmes: c.femmes,
      nonBinaires: c.nonBinaires,
      total_requis: j.total_requis,
      lieu: j.lieu,
      convocation_precisions: j.convocation_precisions,
      convocation_hmc: j.convocation_hmc,
      convocation_accessoires: j.convocation_accessoires,
      convocation_commentaires: j.convocation_commentaires,
      pdt_vers: j.pdt_vers,
    };
  });
}
