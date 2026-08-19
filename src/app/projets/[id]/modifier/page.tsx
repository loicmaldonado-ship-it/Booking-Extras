import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjetForm } from "@/components/projets/projet-form";
import { BackLink } from "@/components/ui/back-link";
import { updateProjet } from "@/lib/projets/actions";
import type { Projet } from "@/lib/projets/types";

export default async function ModifierProjetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: projet } = await supabase
    .from("projets")
    .select("*")
    .eq("id", id)
    .single<Projet>();

  if (!projet) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={`/projets/${id}`} label="Retour au projet" />

      <div>
        <h1 className="text-3xl font-semibold">Modifier {projet.nom}</h1>
      </div>
      <ProjetForm action={updateProjet.bind(null, id)} projet={projet} />
    </div>
  );
}
