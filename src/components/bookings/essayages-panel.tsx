import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export type EssayageRow = {
  id: string;
  numero: number;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  statut: "proposé" | "confirmé" | "fait";
  figurant_id: string;
};

export type BookedFigurant = { id: string; prenom: string; nom: string };

function statutTone(statut: EssayageRow["statut"]) {
  if (statut === "fait") return "turquoise" as const;
  if (statut === "confirmé") return "yellow" as const;
  return "default" as const;
}

export function EssayagesPanel({
  figurants,
  essayages,
  projetId,
}: {
  figurants: BookedFigurant[];
  essayages: EssayageRow[];
  projetId: string;
}) {
  const byFigurant = new Map<string, EssayageRow[]>();
  for (const e of essayages) {
    const list = byFigurant.get(e.figurant_id) ?? [];
    list.push(e);
    byFigurant.set(e.figurant_id, list);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">
        Essayages des figurant·es bookés cette journée sur ce projet, tous dates confondues.
      </p>
      {figurants.map((f) => {
        const list = (byFigurant.get(f.id) ?? []).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        return (
          <Card key={f.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {f.prenom} {f.nom}
              </span>
              <ButtonLink
                href={`/essayages/nouveau?figurant_id=${f.id}&projet_id=${projetId}`}
                variant="ghost"
              >
                + Essayage
              </ButtonLink>
            </div>
            {list.length === 0 ? (
              <p className="text-sm text-text-muted">Aucun essayage programmé.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {list.map((e) => (
                  <Link
                    key={e.id}
                    href={`/essayages/${e.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-ink-raised-2"
                  >
                    <span>
                      {e.date ?? "Date à définir"}
                      {e.heure ? ` · ${e.heure}` : ""}
                      {e.lieu ? ` · ${e.lieu}` : ""}
                    </span>
                    <Badge tone={statutTone(e.statut)}>{e.statut}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {figurants.length === 0 && (
        <p className="text-sm text-text-muted">Aucun booking pour cette journée.</p>
      )}
    </div>
  );
}
