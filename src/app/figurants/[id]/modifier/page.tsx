import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { FigurantForm } from "@/components/figurants/figurant-form";
import { BackLink } from "@/components/ui/back-link";
import { updateFigurant } from "@/lib/figurants/actions";
import type { Figurant, FigurantLien } from "@/lib/figurants/types";

export default async function ModifierFigurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("*")
    .eq("id", id)
    .single<Figurant>();

  if (!figurant) notFound();

  const { data: liens } = await supabase
    .from("figurant_liens")
    .select("*")
    .eq("figurant_id", id)
    .returns<FigurantLien[]>();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={`/figurants/${id}`} label="Retour au profil" />

      <div>
        <h1 className="text-3xl font-semibold">
          Modifier {figurant.prenom} {figurant.nom}
        </h1>
      </div>
      <FigurantForm
        action={updateFigurant.bind(null, id)}
        figurant={figurant}
        liens={liens ?? []}
      />
    </div>
  );
}
