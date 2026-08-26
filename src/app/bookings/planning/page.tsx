import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { PlanningBoard } from "@/components/bookings/planning-board";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

async function withPortraitUrl(
  supabase: ReturnType<typeof createAdminClient>,
  figurants: { id: string; prenom: string; nom: string }[]
) {
  const ids = figurants.map((f) => f.id);
  if (ids.length === 0) return figurants.map((f) => ({ ...f, portraitUrl: null as string | null }));

  const { data: photos } = await supabase
    .from("figurant_photos")
    .select("figurant_id, storage_path")
    .eq("type", "portrait")
    .in("figurant_id", ids);

  const byFigurant = new Map<string, string>();
  for (const p of photos ?? []) {
    if (!byFigurant.has(p.figurant_id)) byFigurant.set(p.figurant_id, p.storage_path);
  }

  const urls = await Promise.all(
    figurants.map(async (f) => {
      const path = byFigurant.get(f.id);
      if (!path) return null;
      const { data } = await supabase.storage.from("figurant-photos").createSignedUrl(path, 60 * 60);
      return data?.signedUrl ?? null;
    })
  );

  return figurants.map((f, i) => ({ ...f, portraitUrl: urls[i] }));
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const currentProjetId = await getCurrentProjetId();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let projetsQuery = supabase.from("projets").select("id, nom, date_debut, date_fin").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));
  const { data: projets } = await projetsQuery;

  const requestedId = params.projet_id ?? currentProjetId ?? undefined;
  const requestedIsAccessible =
    requestedId && (accessibleIds === null || accessibleIds.includes(requestedId));
  const projetId = requestedIsAccessible ? requestedId : projets?.[0]?.id;
  const projet = projets?.find((p) => p.id === projetId) ?? null;

  if (!projet) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Planning</h1>
        <Card>
          <p className="text-sm text-text-muted">
            Crée d&apos;abord un projet pour pouvoir planifier des bookings.
          </p>
        </Card>
      </div>
    );
  }

  let figurantsQuery = supabase.from("figurants").select("id, prenom, nom").order("nom").limit(60);
  if (params.q) {
    figurantsQuery = figurantsQuery.or(`nom.ilike.%${params.q}%,prenom.ilike.%${params.q}%`);
  }
  const { data: figurantsRaw } = await figurantsQuery;

  type BookingRow = {
    id: string;
    date: string;
    fonction: string | null;
    statut: string;
    figurant_id: string;
    figurants: { id: string; prenom: string; nom: string } | null;
  };

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select("id, date, fonction, statut, figurant_id, figurants!bookings_figurant_id_fkey(id, prenom, nom)")
    .eq("projet_id", projet.id)
    .order("date")
    .returns<BookingRow[]>();

  const figurants = await withPortraitUrl(supabase, figurantsRaw ?? []);

  const bookingFigurantIds = (bookingsRaw ?? []).map((b) => b.figurant_id);
  const bookingFigurants = await withPortraitUrl(
    supabase,
    (bookingsRaw ?? [])
      .map((b) => b.figurants)
      .filter((f): f is { id: string; prenom: string; nom: string } => !!f)
  );
  const portraitByFigurantId = new Map(bookingFigurants.map((f) => [f.id, f.portraitUrl]));

  const bookings = (bookingsRaw ?? []).map((b) => ({
    id: b.id,
    date: b.date,
    fonction: b.fonction,
    statut: b.statut,
    figurant: b.figurants
      ? {
          id: b.figurants.id,
          prenom: b.figurants.prenom,
          nom: b.figurants.nom,
          portraitUrl: portraitByFigurantId.get(b.figurants.id) ?? null,
        }
      : null,
  }));

  void bookingFigurantIds;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          <Link href="/bookings" className="hover:text-text">
            ← Bookings
          </Link>
        </p>
        <h1 className="text-3xl font-semibold">Planning</h1>
        <p className="mt-1 text-text-muted">
          Glisse la photo d&apos;un·e figurant·e sur une journée pour créer son booking.
        </p>
      </div>

      <PlanningBoard
        projets={(projets ?? []).map((p) => ({ id: p.id, nom: p.nom }))}
        projetId={projet.id}
        dateDebut={projet.date_debut}
        dateFin={projet.date_fin}
        figurants={figurants}
        bookings={bookings}
        query={params.q ?? ""}
      />
    </div>
  );
}
