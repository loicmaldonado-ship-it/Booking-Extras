"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updatePresentielLieu } from "@/lib/casting-presentiel/actions";

export function PresentielLieuField({ journeeId, lieu }: { journeeId: string; lieu: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(lieu ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updatePresentielLieu(journeeId, value.trim() || null);
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Adresse du casting"
          className="w-64 rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none focus:border-coral"
        />
        {error && <span className="text-xs text-danger">{error}</span>}
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "..." : "OK"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-text-muted hover:text-text">
          Annuler
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="hover:text-text hover:underline">
      {lieu ?? "Lieu non renseigné — cliquer pour ajouter"}
    </button>
  );
}
