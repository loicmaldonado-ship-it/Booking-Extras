import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { PartageCard } from "@/components/partage/partage-card";
import { getSiteOrigin } from "@/lib/partage/data";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { projetNomPublic } from "@/lib/projets/types";
import { Share2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PartagePage() {
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;
  const origin = await getSiteOrigin();

  let query = supabase
    .from("projets")
    .select("id, nom, confidentiel, nom_code")
    .order("nom");
  if (accessibleIds !== null) query = query.in("id", idsOrNone(accessibleIds));

  const [{ data: projets }, { data: liens }] = await Promise.all([
    query,
    supabase.from("partage_liens").select("projet_id, type, token").eq("type", "documents"),
  ]);

  const tokenByProjet = new Map((liens ?? []).map((l) => [l.projet_id, l.token]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold"><Share2 size={28} strokeWidth={1.75} />Partage</h1>
        <p className="mt-1 text-text-muted">
          Génère des liens en lecture seule pour que d&apos;autres départements consultent les trombis et
          fiches mensuration d&apos;un projet, rangés par date, sans avoir de compte.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {(projets ?? []).map((p) => (
          <Card key={p.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{projetNomPublic(p, p.nom)}</h2>
            <PartageCard
              projetId={p.id}
              type="documents"
              label="Documents (Trombis & Fiches mensuration)"
              description="Liste des journées du projet, avec accès en lecture aux trombis et fiches mensuration de chaque date."
              token={tokenByProjet.get(p.id) ?? null}
              publicBaseUrl={`${origin}/partage/documents`}
            />
          </Card>
        ))}
        {(projets ?? []).length === 0 && (
          <p className="text-sm text-text-muted">Aucun projet accessible pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
