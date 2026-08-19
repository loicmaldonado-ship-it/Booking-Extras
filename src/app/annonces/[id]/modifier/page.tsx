import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnnonceForm } from "@/components/annonces/annonce-form";
import { BackLink } from "@/components/ui/back-link";
import { updateAnnonce } from "@/lib/annonces/actions";
import type { Annonce } from "@/lib/annonces/types";

export default async function ModifierAnnoncePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: annonce }, { data: projets }] = await Promise.all([
    supabase.from("annonces").select("*").eq("id", id).single<Annonce>(),
    supabase.from("projets").select("id, nom").order("nom"),
  ]);

  if (!annonce) notFound();

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
