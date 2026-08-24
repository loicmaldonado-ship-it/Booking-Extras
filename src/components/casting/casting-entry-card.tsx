"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomButton } from "@/components/ui/zoomable-image";
import { deleteCastingEntry } from "@/lib/casting/actions";
import type { CastingEntry } from "@/lib/casting/types";

export function CastingEntryCard({
  entry,
  portraitUrl,
  videoUrls,
  selected,
  onToggleSelect,
}: {
  entry: CastingEntry;
  portraitUrl: string | null;
  videoUrls: string[];
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      await deleteCastingEntry(entry.id);
      router.refresh();
    });
  }

  return (
    <div className="relative flex w-52 flex-col gap-2 rounded-xl border border-border bg-ink-raised p-3 text-center">
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-border accent-coral"
        />
      )}
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
      {videoUrls.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {videoUrls.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs text-coral hover:underline">
              Voir la vidéo{videoUrls.length > 1 ? ` ${i + 1}` : ""} ↗
            </a>
          ))}
        </div>
      )}
      <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
        Retirer
      </Button>
    </div>
  );
}
