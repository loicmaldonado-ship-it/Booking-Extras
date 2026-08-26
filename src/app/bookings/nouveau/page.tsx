import { createAdminClient } from "@/lib/supabase/admin";
import { BookingForm } from "@/components/bookings/booking-form";
import { BackLink } from "@/components/ui/back-link";
import { createBooking } from "@/lib/bookings/actions";
import type { BaremeCachet } from "@/lib/bareme/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone, requireProjetAccess } from "@/lib/auth/session";

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

  const [{ data: figurants }, { data: projets }, { data: bareme }] = await Promise.all([
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
    projetsQuery,
    supabase.from("bareme_cachets").select("*").returns<BaremeCachet[]>(),
  ]);

  const backHref =
    params.projet_id && params.date
      ? `/bookings/documents?projet_id=${params.projet_id}&date=${params.date}`
      : "/bookings";

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
        projets={projets ?? []}
        bareme={bareme ?? []}
        defaultFigurantId={params.figurant_id}
        defaultProjetId={params.projet_id}
        defaultDate={params.date}
      />
    </div>
  );
}
