import { createAdminClient } from "@/lib/supabase/admin";
import { BackLink } from "@/components/ui/back-link";
import { ReservePanel } from "@/components/bookings/reserve-panel";
import { getReserve } from "@/lib/reserve/data";
import { requireProjetAccess } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// La réserve du projet : tous les profils mis de côté, en trombinoscope.
export default async function ReservePage({ searchParams }: { searchParams: Promise<{ projet_id?: string }> }) {
  const { projet_id } = await searchParams;
  if (!projet_id) return <p className="text-text-muted">Choisis un projet.</p>;
  await requireProjetAccess(projet_id);

  const [{ data: projet }, profils] = await Promise.all([
    createAdminClient().from("projets").select("nom").eq("id", projet_id).single(),
    getReserve(projet_id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/bookings" label="Bookings" />
      <div>
        <h1 className="text-3xl font-semibold">🗄️ Réserve — {projet?.nom}</h1>
        <p className="mt-1 text-text-muted">
          {profils.length} profil{profils.length > 1 ? "s" : ""} mis de côté. Clique une photo pour l&apos;agrandir.
        </p>
      </div>
      <ReservePanel profils={profils} projet={{ id: projet_id, nom: projet?.nom ?? "" }} />
    </div>
  );
}
