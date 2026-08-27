"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteJournee } from "@/lib/bookings/actions";

export function JourneeDeleteButton({ journeeId }: { journeeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Supprimer cette journée vide ?")) return;
    startTransition(async () => {
      const result = await deleteJournee(journeeId);
      if (result?.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      title="Supprimer cette journée vide"
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink-raised-2 text-xs text-text-muted hover:bg-danger hover:text-ink"
    >
      ×
    </button>
  );
}
