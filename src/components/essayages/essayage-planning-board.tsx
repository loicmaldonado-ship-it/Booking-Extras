"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { assignFigurantToCreneau } from "@/lib/essayages/actions";
import { cn } from "@/lib/cn";
import type { Genre } from "@/lib/figurants/types";
import type { Creneau } from "./creneaux-panel";

export type PlanningRow = {
  id: string;
  figurant_id: string;
  creneau_id: string | null;
  figurants: { prenom: string; nom: string; genre?: Genre | null } | null;
  portraitUrl: string | null;
};

function heureLabel(h: string) {
  return h.slice(0, 5);
}

export function EssayagePlanningBoard({ creneaux, rows }: { creneaux: Creneau[]; rows: PlanningRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  function assign(essayageId: string, creneauId: string | null) {
    startTransition(async () => {
      await assignFigurantToCreneau(essayageId, creneauId);
      router.refresh();
    });
  }

  function Card({ r }: { r: PlanningRow }) {
    return (
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/essayage-id", r.id)}
        className="flex w-24 shrink-0 cursor-grab flex-col items-center gap-1 rounded-xl border border-border bg-ink p-2 text-center active:cursor-grabbing"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
          {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
        </div>
        <span className="truncate text-xs font-medium">
          {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
        </span>
      </div>
    );
  }

  if (creneaux.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Ajoute des créneaux horaires ci-dessus pour construire le planning.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">Glisse un profil sur un créneau pour l&apos;y assigner.{pending ? " Mise à jour..." : ""}</p>

      <div className="flex flex-wrap items-start gap-4">
        {creneaux.map((c) => {
          const assigned = rows.filter((r) => r.creneau_id === c.id);
          const complet = assigned.length >= c.capacite;
          const zoneKey = `creneau-${c.id}`;
          return (
            <div
              key={c.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZone(zoneKey);
              }}
              onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverZone(null);
                const essayageId = e.dataTransfer.getData("text/essayage-id");
                if (essayageId) assign(essayageId, c.id);
              }}
              className={cn(
                "flex w-64 shrink-0 flex-col gap-3 rounded-2xl border p-3 transition-colors",
                dragOverZone === zoneKey
                  ? "border-coral bg-coral/10"
                  : complet
                    ? "border-turquoise/40 bg-turquoise/10"
                    : "border-border bg-ink-raised"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {heureLabel(c.heure_debut)}–{heureLabel(c.heure_fin)}
                </h3>
                <span className="text-xs text-text-muted">
                  {assigned.length}/{c.capacite}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {assigned.map((r) => (
                  <Card key={r.id} r={r} />
                ))}
                {assigned.length === 0 && (
                  <p className="w-full rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-text-muted">
                    Glisser ici
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverZone("pool");
        }}
        onDragLeave={() => setDragOverZone((z) => (z === "pool" ? null : z))}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverZone(null);
          const essayageId = e.dataTransfer.getData("text/essayage-id");
          if (essayageId) assign(essayageId, null);
        }}
        className={cn(
          "flex flex-col gap-2 rounded-2xl border p-3 transition-colors",
          dragOverZone === "pool" ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
        )}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Sans créneau ({rows.filter((r) => !r.creneau_id).length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {rows
            .filter((r) => !r.creneau_id)
            .map((r) => (
              <Card key={r.id} r={r} />
            ))}
          {rows.filter((r) => !r.creneau_id).length === 0 && (
            <p className="text-xs text-text-muted">Tout le monde a un créneau.</p>
          )}
        </div>
      </div>
    </div>
  );
}
