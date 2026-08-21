import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnnonceForm } from "@/components/annonces/annonce-form";
import { BackLink } from "@/components/ui/back-link";
import { updateAnnonce } from "@/lib/annonces/actions";
import type { Annonce } from "@/lib/annonces/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone, requireProjetAccess } from "@/lib/auth/session";

export default async function ModifierAnnoncePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  const { data: annonce } = await supabase.from("annonces").select("*").eq("id", id).single<Annonce>();
  if (!annonce) notFound();
  await requireProjetAccess(annonce.projet_id);

  let projetsQuery = supabase.from("projets").select("id, nom").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));
  const { data: projets } = await projetsQuery;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={`/annonces/${id}`} label="Retour à l'annonce" />

      <div>
        <h1 className="text-3xl font-semibold">Modifier {annonce.titre}</h1>
      </div>
      <AnnonceForm action={updateAnnonce.bind(null, id)} annonce={annonce} projets={projets ?? []} />
    </div>
  );
}
