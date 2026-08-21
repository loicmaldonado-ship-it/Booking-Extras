import { createAdminClient } from "@/lib/supabase/admin";
import { AnnonceForm } from "@/components/annonces/annonce-form";
import { BackLink } from "@/components/ui/back-link";
import { createAnnonce } from "@/lib/annonces/actions";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone, requireProjetAccess } from "@/lib/auth/session";

export default async function NouvelleAnnoncePage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string }>;
}) {
  const { projet_id } = await searchParams;
  if (projet_id) await requireProjetAccess(projet_id);

  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let projetsQuery = supabase.from("projets").select("id, nom").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));
  const { data: projets } = await projetsQuery;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/annonces" label="Annonces" />

      <div>
        <h1 className="text-3xl font-semibold">Nouvelle annonce</h1>
        <p className="mt-1 text-text-muted">
          Un appel à candidature lié à un projet et une date, avec un lien public à diffuser.
        </p>
      </div>
      <AnnonceForm action={createAnnonce} projets={projets ?? []} defaultProjetId={projet_id} />
    </div>
  );
}
