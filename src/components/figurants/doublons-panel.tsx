"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DeleteFigurantConfirm } from "@/components/figurants/delete-figurant-confirm";

export type DoublonGroupe = {
  key: string;
  nom: string;
  telephone: string;
  profils: { id: string; prenom: string; email: string | null; created_at: string }[];
};

export function DoublonsPanel({ groupes, canDelete }: { groupes: DoublonGroupe[]; canDelete: boolean }) {
  const [open, setOpen] = useState(false);

  if (groupes.length === 0) return null;

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
                    {canDelete && <DeleteFigurantConfirm id={p.id} label={`${p.prenom} ${g.nom}`} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-text-muted">
            La suppression définitive est réservée au compte propriétaire et bloquée si le profil possède des candidatures, bookings, photos, messages ou essayages
            associés — vérifie alors laquelle des fiches est la bonne avant d&apos;agir manuellement.
          </p>
        </div>
      )}
    </Card>
  );
}
