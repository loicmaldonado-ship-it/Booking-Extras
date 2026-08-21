import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingForm } from "@/components/bookings/booking-form";
import { BackLink } from "@/components/ui/back-link";
import { updateBooking } from "@/lib/bookings/actions";
import type { Booking } from "@/lib/bookings/types";
import type { BaremeCachet } from "@/lib/bareme/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone, requireProjetAccess } from "@/lib/auth/session";

export default async function ModifierBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let projetsQuery = supabase.from("projets").select("id, nom, convention").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));

  const [{ data: booking }, { data: figurants }, { data: projets }, { data: bareme }] =
    await Promise.all([
      supabase.from("bookings").select("*").eq("id", id).single<Booking>(),
      supabase.from("figurants").select("id, prenom, nom").order("nom"),
      projetsQuery,
      supabase.from("bareme_cachets").select("*").returns<BaremeCachet[]>(),
    ]);

  if (!booking) notFound();
  await requireProjetAccess(booking.projet_id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={`/bookings/${id}`} label="Retour au booking" />

      <div>
        <h1 className="text-3xl font-semibold">Modifier le booking</h1>
      </div>
      <BookingForm
        action={updateBooking.bind(null, id)}
        booking={booking}
        figurants={figurants ?? []}
        projets={projets ?? []}
        bareme={bareme ?? []}
      />
    </div>
  );
}
