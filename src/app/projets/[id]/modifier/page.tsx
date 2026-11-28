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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ alerte?: string }>;
}) {
  const { id } = await params;
  const { alerte } = await searchParams;
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
      {alerte === "indemnites" && (
        <p role="alert" className="rounded-lg border border-danger/40 px-4 py-3 text-sm text-danger">
          Le projet a été créé, mais ses indemnités n&apos;ont pas pu être enregistrées. Ajoute-les ci-dessous.
        </p>
      )}
      <ProjetForm action={updateProjet.bind(null, id)} projet={projet} indemnites={indemnites ?? []} />
    </div>
  );
}
