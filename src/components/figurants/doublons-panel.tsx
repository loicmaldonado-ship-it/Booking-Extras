"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supprimerFigurantDoublon } from "@/lib/figurants/actions";

export type DoublonGroupe = {
  key: string;
  nom: string;
  telephone: string;
  profils: { id: string; prenom: string; email: string | null; created_at: string }[];
};

export function DoublonsPanel({ groupes }: { groupes: DoublonGroupe[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (groupes.length === 0) return null;

  function supprimer(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await supprimerFigurantDoublon(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3 border-danger/40">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center justify-between text-left">
        <span className="text-sm font-semibold text-danger">
          {groupes.length} doublon{groupes.length > 1 ? "s" : ""} potentiel{groupes.length > 1 ? "s" : ""} détecté
          {groupes.length > 1 ? "s" : ""} (même nom + téléphone, emails différents)
        </span>
        <span className="text-text-muted">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          {error && <p className="text-xs text-danger">{error}</p>}
          {groupes.map((g) => (
            <div key={g.key} className="flex flex-col gap-2 rounded-xl border border-border bg-ink px-4 py-3">
              <span className="text-xs font-medium text-text-muted">
                {g.nom} · {g.telephone}
              </span>
              <div className="flex flex-col gap-1">
                {g.profils.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/figurants/${p.id}`} className="hover:text-coral">
                      {p.prenom} {g.nom} — {p.email ?? "sans email"}
                    </Link>
                    <Button type="button" variant="ghost" disabled={pending} onClick={() => supprimer(p.id)}>
                      Supprimer ce doublon
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-text-muted">
            La suppression est bloquée automatiquement si le profil a des candidatures, bookings ou essayages
            associés — vérifie alors laquelle des fiches est la bonne avant d&apos;agir manuellement.
          </p>
        </div>
      )}
    </Card>
  );
}
