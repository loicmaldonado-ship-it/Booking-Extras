import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { BaremeCachetsEditor } from "@/components/bareme/bareme-cachets-editor";
import { BaremeMajorationsEditor } from "@/components/bareme/bareme-majorations-editor";
import type { BaremeCachet, BaremeMajoration } from "@/lib/bareme/types";
import type { Convention } from "@/lib/projets/types";
import { getCurrentProfile } from "@/lib/auth/session";
import { Calculator } from "lucide-react";

export const dynamic = "force-dynamic";

function ConventionSection({
  convention,
  cachets,
  majorations,
  isChef,
}: {
  convention: Convention;
  cachets: BaremeCachet[];
  majorations: BaremeMajoration[];
  isChef: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{convention}</h2>

      <Card className="flex flex-col gap-3 p-0">
        <BaremeCachetsEditor convention={convention} cachets={cachets} isChef={isChef} />
      </Card>

      <Card className="flex flex-col gap-3 p-0">
        <BaremeMajorationsEditor convention={convention} majorations={majorations} isChef={isChef} />
      </Card>
    </div>
  );
}

export default async function BaremePage() {
  const supabase = createAdminClient();

  const [{ data: cachets }, { data: majorations }, profile] = await Promise.all([
    supabase.from("bareme_cachets").select("*").order("cachet").returns<BaremeCachet[]>(),
    supabase.from("bareme_majorations").select("*").order("type").returns<BaremeMajoration[]>(),
    getCurrentProfile(),
  ]);

  const isChef = profile?.role === "chef";
  const dateEffet = cachets?.[0]?.date_effet;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold"><Calculator size={28} strokeWidth={1.75} />Barème ACFDA</h1>
        <p className="mt-1 text-text-muted">
          Grille résumé des salaires (conventions Cinéma / Audiovisuelle)
          {dateEffet ? ` — en vigueur depuis le ${dateEffet}` : ""}. Ne remplace
          pas la lecture des conventions collectives complètes.
          {isChef && " Cliquez sur un montant ou une note pour la modifier."}
        </p>
      </div>

      <ConventionSection
        convention="Cinéma"
        cachets={(cachets ?? []).filter((c) => c.convention === "Cinéma")}
        majorations={(majorations ?? []).filter((m) => m.convention === "Cinéma")}
        isChef={isChef}
      />
      <ConventionSection
        convention="Audiovisuelle"
        cachets={(cachets ?? []).filter((c) => c.convention === "Audiovisuelle")}
        majorations={(majorations ?? []).filter((m) => m.convention === "Audiovisuelle")}
        isChef={isChef}
      />
    </div>
  );
}
