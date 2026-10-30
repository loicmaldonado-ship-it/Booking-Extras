import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BookingForm } from "@/components/bookings/booking-form";
import { BackLink } from "@/components/ui/back-link";
import { createBooking } from "@/lib/bookings/actions";
import { baremePourEquipes, clesEquipeProjets } from "@/lib/bareme/equipe";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone, requireProjetAccess } from "@/lib/auth/session";
import { comedienPoolClause } from "@/lib/figurants/comedien-privacy";

export default async function NouveauBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ figurant_id?: string; projet_id?: string; date?: string }>;
}) {
  const params = await searchParams;
  if (params.projet_id) await requireProjetAccess(params.projet_id);

  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let projetsQuery = supabase.from("projets").select("id, nom, convention").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));

  // Liste soumise à la RLS (SEC-04/CAN-02) : profils sans compte et comédiens privés des autres équipes exclus.
  let figurantsQuery = (await createServerSupabaseClient()).from("figurants").select("id, prenom, nom").order("nom").order("prenom");
  const comedienClause = comedienPoolClause(profile);
  if (comedienClause) figurantsQuery = figurantsQuery.or(comedienClause);

  const [{ data: figurants }, { data: projets }] = await Promise.all([
    figurantsQuery,
    projetsQuery,
  ]);

  const backHref =
    params.projet_id && params.date
      ? `/bookings/documents?projet_id=${params.projet_id}&date=${params.date}`
      : "/bookings";

  // Barème de l'équipe de chaque projet proposé (barème par équipe).
  const clesEquipe = await clesEquipeProjets(supabase, (projets ?? []).map((p) => p.id));
  const { cachets: bareme } = await baremePourEquipes(supabase, [...clesEquipe.values()]);
  const projetsAvecEquipe = (projets ?? []).map((p) => ({ ...p, equipe_cle: clesEquipe.get(p.id) ?? null }));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={backHref} label={params.projet_id && params.date ? "Retour à la journée" : "Retour"} />

      <div>
        <h1 className="text-3xl font-semibold">Nouveau booking</h1>
        <p className="mt-1 text-text-muted">Une journée de tournage pour un·e figurant·e.</p>
      </div>
      <BookingForm
        action={createBooking}
        figurants={figurants ?? []}
        projets={projetsAvecEquipe}
        bareme={bareme}
        defaultFigurantId={params.figurant_id}
        defaultProjetId={params.projet_id}
        defaultDate={params.date}
      />
    </div>
  );
}
