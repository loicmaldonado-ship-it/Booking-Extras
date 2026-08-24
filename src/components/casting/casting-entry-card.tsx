"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomButton } from "@/components/ui/zoomable-image";
import { toggleCastingSilhouette, updateCastingRoleLabel, deleteCastingEntry } from "@/lib/casting/actions";
import type { CastingEntry } from "@/lib/casting/types";

export function CastingEntryCard({
  entry,
  portraitUrl,
  videoUrl,
}: {
  entry: CastingEntry;
  portraitUrl: string | null;
  videoUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roleLabel, setRoleLabel] = useState(entry.role_label ?? "");

  function toggleSilhouette() {
    startTransition(async () => {
      await toggleCastingSilhouette(entry.id, !entry.silhouette);
      router.refresh();
    });
  }

  function saveRoleLabel() {
    const trimmed = roleLabel.trim();
    if (trimmed === (entry.role_label ?? "")) return;
    startTransition(async () => {
      await updateCastingRoleLabel(entry.id, trimmed || null);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteCastingEntry(entry.id);
      router.refresh();
    });
  }

  return (
    <div className="flex w-52 flex-col gap-2 rounded-xl border border-border bg-ink-raised p-3 text-center">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
        {portraitUrl && (
          <>
            <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />
            <ZoomButton src={portraitUrl} />
          </>
        )}
      </div>
      <div className="text-sm font-medium">
        {entry.figurants?.prenom} {entry.figurants?.nom}
      </div>
      {entry.submitted_at ? (
        <Badge tone="turquoise">Envoyé</Badge>
      ) : (
        <Badge tone="yellow">En attente</Badge>
      )}
      {videoUrl && (
        <a href={videoUrl} target="_blank" rel="noreferrer" className="text-xs text-coral hover:underline">
          Voir la vidéo ↗
        </a>
      )}
      {!entry.silhouette && (
        <input
          type="text"
          value={roleLabel}
          disabled={pending}
          placeholder="Nom du rôle"
          onChange={(e) => setRoleLabel(e.target.value)}
          onBlur={saveRoleLabel}
          className="rounded-lg border border-border bg-ink px-2 py-1 text-center text-xs"
        />
      )}
      <button
        type="button"
        disabled={pending}
        onClick={toggleSilhouette}
        className="rounded-full border border-border px-2 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
      >
        {entry.silhouette ? "Figurant (trombi seul)" : "Rôle (avec vidéo)"}
      </button>
      <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
        Retirer
      </Button>
    </div>
  );
}
