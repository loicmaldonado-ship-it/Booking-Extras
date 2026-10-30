"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archiverProjet, desarchiverProjet, deleteProjet } from "@/lib/projets/actions";

// Les actions renvoient { error } (ou redirigent en cas de succès) : l'erreur est affichée ici, y compris en production.
function Erreur({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-danger">{message}</p> : null;
}

export function ArchiverProjetButton({
  projetId,
  temporaireCount,
  dejaArchive = false,
}: {
  projetId: string;
  temporaireCount: number;
  dejaArchive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirmArchive() {
    setError(null);
    startTransition(async () => {
      const res = await archiverProjet(projetId);
      if (res?.error) setError(res.error);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        {dejaArchive ? "Supprimer les profils temporaires restants" : "Archiver"}
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
          {pending ? "Archivage..." : dejaArchive ? "Confirmer la suppression" : "Confirmer l'archivage"}
        </Button>
      </div>
      <Erreur message={error} />
    </div>
  );
}

export function DesarchiverProjetButton({ projetId }: { projetId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await desarchiverProjet(projetId);
            if (res?.error) setError(res.error);
          });
        }}
      >
        {pending ? "..." : "Désarchiver"}
      </Button>
      <Erreur message={error} />
    </div>
  );
}

export function SupprimerProjetButton({ projetId, nom }: { projetId: string; nom: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Supprimer définitivement
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
      <p>
        <strong>{nom}</strong> et tout ce qui lui est rattaché (bookings, candidatures, essayages, annonces...)
        seront <strong>définitivement supprimés</strong>. Cette action est irréversible.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await deleteProjet(projetId);
              if (res?.error) setError(res.error);
            });
          }}
        >
          {pending ? "Suppression..." : "Confirmer la suppression"}
        </Button>
      </div>
      <Erreur message={error} />
    </div>
  );
}
