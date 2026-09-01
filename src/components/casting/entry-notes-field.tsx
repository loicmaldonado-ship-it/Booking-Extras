"use client";

import { useState, useTransition } from "react";

// Champ notes compact, partagé entre les cartes de casting (rôles
// selftape/présentiel) et de casting présentiel — sauvegarde à la perte de
// focus, pas besoin d'un bouton dédié pour un texte aussi court.
export function EntryNotesField({
  initialValue,
  onSave,
}: {
  initialValue: string | null;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    if (value === (initialValue ?? "")) return;
    startTransition(async () => {
      await onSave(value);
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={2}
        placeholder="Notes (spécificités...)"
        className="w-full resize-none rounded-lg border border-border bg-ink px-2 py-1.5 text-xs outline-none focus:border-coral"
      />
      {pending && <span className="text-[10px] text-text-muted">Enregistrement...</span>}
    </div>
  );
}
