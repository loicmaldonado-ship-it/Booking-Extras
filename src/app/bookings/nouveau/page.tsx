import { createAdminClient } from "@/lib/supabase/admin";
import { BookingForm } from "@/components/bookings/booking-form";
import { BackLink } from "@/components/ui/back-link";
import { createBooking } from "@/lib/bookings/actions";
import type { BaremeCachet } from "@/lib/bareme/types";

export default async function NouveauBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ figurant_id?: string; projet_id?: string; date?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const [{ data: figurants }, { data: projets }, { data: bareme }] = await Promise.all([
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
    supabase.from("projets").select("id, nom, convention").order("nom"),
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
        <p className="mt-1 text-text-muted">Une journée de tournage pour un figurant.</p>
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
