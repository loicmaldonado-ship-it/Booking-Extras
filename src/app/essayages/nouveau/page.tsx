import { createAdminClient } from "@/lib/supabase/admin";
import { EssayageForm } from "@/components/essayages/essayage-form";
import { BackLink } from "@/components/ui/back-link";
import { createEssayage } from "@/lib/essayages/actions";

export default async function NouvelEssayagePage({
  searchParams,
}: {
  searchParams: Promise<{ figurant_id?: string; projet_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();

  const [{ data: figurants }, { data: projets }] = await Promise.all([
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
    supabase.from("projets").select("id, nom").order("nom"),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/essayages" label="Essayages" />

      <div>
        <h1 className="text-3xl font-semibold">Nouvel essayage</h1>
        <p className="mt-1 text-text-muted">Un rendez-vous costume, séparé du jour de tournage.</p>
      </div>
      <EssayageForm
        action={createEssayage}
        figurants={figurants ?? []}
        projets={projets ?? []}
        defaultFigurantId={params.figurant_id}
        defaultProjetId={params.projet_id}
      />
    </div>
  );
}
