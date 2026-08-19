import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { formatMajorationValeur, type BaremeCachet, type BaremeMajoration } from "@/lib/bareme/types";
import type { Convention } from "@/lib/projets/types";
import { Calculator } from "lucide-react";

export const dynamic = "force-dynamic";

function ConventionSection({
  convention,
  cachets,
  majorations,
}: {
  convention: Convention;
  cachets: BaremeCachet[];
  majorations: BaremeMajoration[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{convention}</h2>

      <Card className="flex flex-col gap-3 p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-6 py-3 font-medium">Cachet</th>
              <th className="px-6 py-3 font-medium">Montant brut</th>
              <th className="px-6 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {cachets.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3 font-medium">{c.cachet}</td>
                <td className="px-6 py-3 text-turquoise">{c.montant_brut.toFixed(2)} €</td>
                <td className="px-6 py-3 text-text-muted">{c.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="flex flex-col gap-3 p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-6 py-3 font-medium">Majoration</th>
              <th className="px-6 py-3 font-medium">Valeur</th>
              <th className="px-6 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {majorations.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3">
                  {m.label}
                  {m.cinema_uniquement && (
                    <Badge tone="yellow" className="ml-2">
                      Cinéma uniquement
                    </Badge>
                  )}
                </td>
                <td className="px-6 py-3 text-turquoise">{formatMajorationValeur(m)}</td>
                <td className="px-6 py-3 text-text-muted">{m.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default async function BaremePage() {
  const supabase = createAdminClient();

  const [{ data: cachets }, { data: majorations }] = await Promise.all([
    supabase.from("bareme_cachets").select("*").order("cachet").returns<BaremeCachet[]>(),
    supabase.from("bareme_majorations").select("*").order("type").returns<BaremeMajoration[]>(),
  ]);

  const dateEffet = cachets?.[0]?.date_effet;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold"><Calculator size={28} strokeWidth={1.75} />Barème ACFDA</h1>
        <p className="mt-1 text-text-muted">
          Grille résumé des salaires (conventions Cinéma / Audiovisuelle)
          {dateEffet ? ` — en vigueur depuis le ${dateEffet}` : ""}. Ne remplace
          pas la lecture des conventions collectives complètes.
        </p>
      </div>

      <ConventionSection
        convention="Cinéma"
        cachets={(cachets ?? []).filter((c) => c.convention === "Cinéma")}
        majorations={(majorations ?? []).filter((m) => m.convention === "Cinéma")}
      />
      <ConventionSection
        convention="Audiovisuelle"
        cachets={(cachets ?? []).filter((c) => c.convention === "Audiovisuelle")}
        majorations={(majorations ?? []).filter((m) => m.convention === "Audiovisuelle")}
      />
    </div>
  );
}
