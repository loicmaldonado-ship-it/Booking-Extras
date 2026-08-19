import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { BookingForm } from "@/components/bookings/booking-form";
import { BackLink } from "@/components/ui/back-link";
import { updateBooking } from "@/lib/bookings/actions";
import type { Booking } from "@/lib/bookings/types";
import type { BaremeCachet } from "@/lib/bareme/types";

export default async function ModifierBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: booking }, { data: figurants }, { data: projets }, { data: bareme }] =
    await Promise.all([
      supabase.from("bookings").select("*").eq("id", id).single<Booking>(),
      supabase.from("figurants").select("id, prenom, nom").order("nom"),
      supabase.from("projets").select("id, nom, convention").order("nom"),
      supabase.from("bareme_cachets").select("*").returns<BaremeCachet[]>(),
    ]);

  if (!booking) notFound();

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
