"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";
import { Button } from "@/components/ui/button";
import { ZoomButton } from "@/components/ui/zoomable-image";
import type { PhotoType } from "@/lib/figurants/types";
import { toGalleryPhotos, galleryIndexOfUrl } from "@/lib/figurants/photo-labels";

type FigurantCard = {
  id: string;
  prenom: string;
  nom: string;
  ville: string | null;
  portraitUrl: string | null;
  photos?: { url: string | null; type: PhotoType }[];
};

export function FigurantsTrombiGrid({
  figurants,
  projets,
}: {
  figurants: FigurantCard[];
  projets: { id: string; nom: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = figurants.length > 0 && selected.size === figurants.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(figurants.map((f) => f.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={toggleAll} disabled={figurants.length === 0}>
          {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </Button>
        {selected.size > 0 && (
          <Link
            href={`/figurants/fiches?ids=${Array.from(selected).join(",")}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-coral"
          >
            Fiches de renseignements ({selected.size})
          </Link>
        )}
      </div>

      {selected.size > 0 && (
        <AddToJourneeBar
          figurantIds={Array.from(selected)}
          projets={projets}
          onDone={() => setSelected(new Set())}
        />
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {figurants.map((f) => (
          <div
            key={f.id}
            className={cn(
              "relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
              selected.has(f.id)
                ? "border-coral bg-coral/10"
                : "border-border bg-ink-raised hover:border-coral/60"
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(f.id)}
              onChange={() => toggle(f.id)}
              className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-border accent-coral"
            />
            <Link href={`/figurants/${f.id}`} className="flex w-full flex-col items-center gap-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
                {f.portraitUrl && <Image src={f.portraitUrl} alt="" fill className="object-cover" unoptimized />}
                {f.portraitUrl && (() => {
                  const gallery = toGalleryPhotos(f.photos);
                  return <ZoomButton src={f.portraitUrl!} gallery={gallery} index={galleryIndexOfUrl(gallery, f.portraitUrl)} />;
                })()}
              </div>
              <div className="text-sm font-medium">
                {f.prenom} {f.nom}
              </div>
              <div className="text-xs text-text-muted">{f.ville ?? "—"}</div>
            </Link>
          </div>
        ))}
        {figurants.length === 0 && (
          <p className="col-span-full py-10 text-center text-text-muted">Aucun figurant pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
