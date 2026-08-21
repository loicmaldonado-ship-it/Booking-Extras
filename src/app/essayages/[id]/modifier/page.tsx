import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EssayageForm } from "@/components/essayages/essayage-form";
import { BackLink } from "@/components/ui/back-link";
import { updateEssayage } from "@/lib/essayages/actions";
import type { Essayage } from "@/lib/essayages/types";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone, requireProjetAccess } from "@/lib/auth/session";

export default async function ModifierEssayagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let projetsQuery = supabase.from("projets").select("id, nom").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));

  const [{ data: essayage }, { data: figurants }, { data: projets }] = await Promise.all([
    supabase.from("essayages").select("*").eq("id", id).single<Essayage>(),
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
    projetsQuery,
  ]);

  if (!essayage) notFound();
  await requireProjetAccess(essayage.projet_id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={`/essayages/${id}`} label="Retour à l'essayage" />

      <div>
        <h1 className="text-3xl font-semibold">Modifier l&apos;essayage #{essayage.numero}</h1>
      </div>
      <EssayageForm
        action={updateEssayage.bind(null, id)}
        essayage={essayage}
        figurants={figurants ?? []}
        projets={projets ?? []}
      />
    </div>
  );
}
