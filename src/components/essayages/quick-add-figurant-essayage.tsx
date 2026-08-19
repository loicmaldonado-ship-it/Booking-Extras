"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addFigurantToEssayageJournee } from "@/lib/essayages/actions";

type FigurantOption = { id: string; prenom: string; nom: string };

export function QuickAddFigurantEssayage({
  essayageJourneeId,
  projetId,
  date,
  lieu,
  figurants,
  alreadyAddedIds,
}: {
  essayageJourneeId: string;
  projetId: string;
  date: string;
  lieu: string | null;
  figurants: FigurantOption[];
  alreadyAddedIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const addedSet = useMemo(() => new Set(alreadyAddedIds), [alreadyAddedIds]);

  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    return figurants
      .filter((f) => !addedSet.has(f.id))
      .filter((f) => `${f.prenom} ${f.nom}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, figurants, addedSet]);

  function add(figurantId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addFigurantToEssayageJournee(essayageJourneeId, figurantId, projetId, date, lieu);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setQuery("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Ajouter un profil
      </Button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un nom..."
          disabled={pending}
          className="w-64 rounded-full border border-border bg-ink px-4 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setQuery("");
            setError(null);
          }}
        >
          Annuler
        </Button>
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {query.trim().length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-ink-raised-2 shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">Aucun profil trouvé.</p>
          ) : (
            results.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={pending}
                onClick={() => add(f.id)}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-ink-raised disabled:opacity-60"
              >
                {f.prenom} {f.nom}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
