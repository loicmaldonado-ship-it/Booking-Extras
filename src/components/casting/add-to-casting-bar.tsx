"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addFigurantsToCasting } from "@/lib/casting/actions";

export function AddToCastingBar({
  figurantIds,
  projets,
  onDone,
}: {
  figurantIds: string[];
  projets: { id: string; nom: string }[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [projetId, setProjetId] = useState(projets[0]?.id ?? "");
  const [roleNom, setRoleNom] = useState("");
  const [dateTournage, setDateTournage] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: number; deja: number; echecs: number } | string | null>(null);

  function submit() {
    if (!projetId || !roleNom.trim() || figurantIds.length === 0) return;
    setResult(null);
    startTransition(async () => {
      const res = await addFigurantsToCasting(figurantIds, projetId, roleNom.trim(), dateTournage || null);
      if (res.error) {
        setResult(res.error);
        return;
      }
      setResult({ ok: res.ok ?? 0, deja: res.deja ?? 0, echecs: res.echecs ?? 0 });
      setRoleNom("");
      setDateTournage("");
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-turquoise/40 bg-turquoise/10 px-4 py-3">
      <span className="text-sm font-medium">
        {figurantIds.length} sélectionné{figurantIds.length > 1 ? "s" : ""}
      </span>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Projet</label>
        <select
          value={projetId}
          onChange={(e) => setProjetId(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        >
          <option value="" disabled>
            Choisir un projet
          </option>
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Rôle</label>
        <input
          type="text"
          value={roleNom}
          onChange={(e) => setRoleNom(e.target.value)}
          placeholder="Boulanger, Silhouettes marché..."
          disabled={pending}
          className="w-48 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Tournage (optionnel)</label>
        <input
          type="date"
          value={dateTournage}
          onChange={(e) => setDateTournage(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
      </div>
      <Button type="button" disabled={pending || !projetId || !roleNom.trim()} onClick={submit}>
        {pending ? "Envoi..." : "Ajouter au casting"}
      </Button>
      {result && typeof result === "string" && <span className="text-xs text-danger">{result}</span>}
      {result && typeof result === "object" && (
        <span className="text-xs text-text-muted">
          {result.ok} ajouté{result.ok > 1 ? "s" : ""}
          {result.deja > 0 ? ` · ${result.deja} déjà dans ce rôle` : ""}
          {result.echecs > 0 ? ` · ${result.echecs} échec(s) (email manquant ?)` : ""}
        </span>
      )}
    </div>
  );
}
