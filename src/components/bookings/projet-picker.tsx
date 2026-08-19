import { Card, Badge } from "@/components/ui/card";
import { setCurrentProjet } from "@/lib/projet-context";

export function ProjetPicker({
  projets,
  redirectTo = "/bookings",
  sectionLabel = "Bookings",
}: {
  projets: { id: string; nom: string; confidentiel: boolean }[];
  redirectTo?: string;
  sectionLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Sur quel projet veux-tu travailler ?</h1>
        <p className="mt-1 text-text-muted">
          Ce projet reste actif dans {sectionLabel} tant que tu n&apos;en changes pas — pour ne pas mélanger
          plusieurs tournages en cours.
        </p>
      </div>

      {projets.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">Crée d&apos;abord un projet pour pouvoir booker.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {projets.map((p) => (
            <form key={p.id} action={setCurrentProjet.bind(null, p.id, redirectTo)}>
              <button
                type="submit"
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-ink-raised px-5 py-4 text-left transition-colors hover:border-coral/60"
              >
                <span className="font-medium">{p.nom}</span>
                {p.confidentiel && <Badge tone="coral">Confidentiel</Badge>}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
