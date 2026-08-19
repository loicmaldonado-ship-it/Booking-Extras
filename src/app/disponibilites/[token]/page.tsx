import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { AvailabilityCalendar } from "@/components/figurants/availability-calendar";

export const dynamic = "force-dynamic";

export default async function DisponibilitesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom")
    .eq("token_disponibilite", token)
    .single();

  if (!figurant) notFound();

  const { data: indispos } = await supabase
    .from("figurant_indisponibilites")
    .select("date")
    .eq("figurant_id", figurant.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour {figurant.prenom},</h1>
        <p className="mt-1 text-text-muted">
          Clique les jours où tu n&apos;es pas disponible. C&apos;est enregistré automatiquement, tu peux
          revenir modifier à tout moment avec ce même lien.
        </p>
      </div>

      <Card>
        <AvailabilityCalendar token={token} initialDates={(indispos ?? []).map((i) => i.date)} />
      </Card>
    </div>
  );
}
