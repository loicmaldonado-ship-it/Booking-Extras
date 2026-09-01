"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { addFigurantToPresentielJournee } from "@/lib/casting-presentiel/actions";

type FigurantOption = { id: string; prenom: string; nom: string; roleIds: string[] };
type RoleOption = { id: string; nom: string };

export function QuickAddFigurantPresentiel({
  journeeId,
  projetId,
  figurants,
  roles,
  alreadyAddedIds,
}: {
  journeeId: string;
  projetId: string;
  figurants: FigurantOption[];
  roles: RoleOption[];
  alreadyAddedIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [roleId, setRoleId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const addedSet = useMemo(() => new Set(alreadyAddedIds), [alreadyAddedIds]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Sans rôle choisi, il faut taper un nom pour ne pas déverser toute la
    // base d'un coup. Avec un rôle choisi, on montre directement les
    // profils déjà dans ce rôle — c'est justement ce qu'on vient chercher.
    if (!roleId && q.length < 1) return [];
    let pool = figurants.filter((f) => !addedSet.has(f.id));
    if (roleId) pool = pool.filter((f) => f.roleIds.includes(roleId));
    if (q.length > 0) pool = pool.filter((f) => `${f.prenom} ${f.nom}`.toLowerCase().includes(q));
    return pool.slice(0, roleId ? 30 : 8);
  }, [query, figurants, addedSet, roleId]);

  function add(figurantId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addFigurantToPresentielJournee(journeeId, figurantId, projetId, roleId || null);
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
    <div className="relative flex flex-wrap items-center gap-2">
      {roles.length > 0 && (
        <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-44">
          <option value="">Choisir un rôle...</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nom}
            </option>
          ))}
        </Select>
      )}
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={roleId ? "Filtrer par nom (optionnel)..." : "Chercher un nom..."}
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

      {error && <p className="w-full text-xs text-danger">{error}</p>}

      {(query.trim().length > 0 || roleId) && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-ink-raised-2 shadow-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted">
              {roleId ? "Aucun profil dans ce rôle." : "Aucun profil trouvé."}
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {results.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={pending}
                  onClick={() => add(f.id)}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-ink-raised disabled:opacity-60"
                >
                  {f.prenom} {f.nom}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
