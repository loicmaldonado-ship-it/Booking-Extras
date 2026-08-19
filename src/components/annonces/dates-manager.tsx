"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addAnnonceDate, removeAnnonceDate } from "@/lib/annonces/dates";
import type { AnnonceDate } from "@/lib/annonces/dates";
import { formatDateShort } from "@/lib/format-date";

export function DatesManager({ annonceId, dates }: { annonceId: string; dates: AnnonceDate[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addAnnonceDate.bind(null, annonceId), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [hasDate, setHasDate] = useState(false);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  function remove(id: string) {
    removeAnnonceDate(id, annonceId).then(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3">
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-full border border-border bg-ink px-3 py-1.5 text-sm"
            >
              <span>{formatDateShort(d.date)}</span>
              <button
                type="button"
                onClick={() => remove(d.id)}
                className="text-text-muted hover:text-coral"
                title="Supprimer cette date"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={formAction}
        onReset={() => setHasDate(false)}
        className="flex gap-3"
      >
        <input
          type="date"
          name="date"
          onChange={(e) => setHasDate(!!e.target.value)}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
        <Button type="submit" variant="secondary" disabled={pending || !hasDate}>
          {pending ? "Ajout..." : "Ajouter"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
