import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjetForm } from "@/components/projets/projet-form";
import { BackLink } from "@/components/ui/back-link";
import { updateProjet } from "@/lib/projets/actions";
import type { Projet } from "@/lib/projets/types";
import type { ProjetIndemnite } from "@/lib/indemnites/types";
import { requireProjetAccess } from "@/lib/auth/session";

export default async function ModifierProjetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProjetAccess(id);
  const supabase = createAdminClient();

  const [{ data: projet }, { data: indemnites }] = await Promise.all([
    supabase.from("projets").select("*").eq("id", id).single<Projet>(),
    supabase
      .from("projet_indemnites")
      .select("*")
      .eq("projet_id", id)
      .order("created_at")
      .returns<ProjetIndemnite[]>(),
  ]);

  if (!projet) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={`/projets/${id}`} label="Retour au projet" />

      <div>
        <h1 className="text-3xl font-semibold">Modifier {projet.nom}</h1>
      </div>
      <ProjetForm action={updateProjet.bind(null, id)} projet={projet} indemnites={indemnites ?? []} />
    </div>
  );
}
