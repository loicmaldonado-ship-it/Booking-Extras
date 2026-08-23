"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archiverProjet, desarchiverProjet } from "@/lib/projets/actions";

export function ArchiverProjetButton({
  projetId,
  temporaireCount,
}: {
  projetId: string;
  temporaireCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmArchive() {
    startTransition(() => {
      archiverProjet(projetId);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Archiver
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
      <p>
        {temporaireCount > 0 ? (
          <>
            <strong>{temporaireCount}</strong> profil{temporaireCount > 1 ? "s" : ""} temporaire
            {temporaireCount > 1 ? "s" : ""} (rôles soi-même) {temporaireCount > 1 ? "seront" : "sera"}{" "}
            <strong>définitivement supprimé{temporaireCount > 1 ? "s" : ""}</strong>.
          </>
        ) : (
          "Aucun profil temporaire à supprimer sur ce projet."
        )}{" "}
        Cette action est irréversible.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button type="button" variant="danger" disabled={pending} onClick={confirmArchive}>
          {pending ? "Archivage..." : "Confirmer l'archivage"}
        </Button>
      </div>
    </div>
  );
}

export function DesarchiverProjetButton({ projetId }: { projetId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() => startTransition(() => desarchiverProjet(projetId))}
    >
      {pending ? "..." : "Désarchiver"}
    </Button>
  );
}
