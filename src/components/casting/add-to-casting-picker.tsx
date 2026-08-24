"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requestCastingVideo } from "@/lib/casting/actions";

type PoolFigurant = { id: string; prenom: string; nom: string; email: string | null };

export function AddToCastingPicker({ projetId, pool }: { projetId: string; pool: PoolFigurant[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function request(figurant: PoolFigurant) {
    setError(null);
    setPendingId(figurant.id);
    startTransition(async () => {
      const result = await requestCastingVideo(projetId, figurant.id);
      setPendingId(null);
      if (result?.error) {
        setError(`${figurant.prenom} ${figurant.nom} : ${result.error}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ajouter au casting</h2>
        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Fermer" : `Choisir un profil (${pool.length})`}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {open && (
        <div className="flex flex-col gap-2">
          {pool.length === 0 && (
            <p className="text-sm text-text-muted">
              Aucun profil disponible — booke ou fais candidater quelqu&apos;un sur ce projet d&apos;abord.
            </p>
          )}
          {pool.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-ink px-3 py-2 text-sm"
            >
              <span>
                {f.prenom} {f.nom}
                {!f.email && <span className="ml-2 text-xs text-text-muted">Pas d&apos;email</span>}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={!f.email || pendingId === f.id}
                onClick={() => request(f)}
              >
                {pendingId === f.id ? "Envoi..." : "Demander vidéo/photo"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
