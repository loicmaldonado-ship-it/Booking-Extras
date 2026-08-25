"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateProjetAnnoncePhoto, removeProjetAnnoncePhoto } from "@/lib/projets/annonce-photo-actions";

export function AnnoncePhotoPanel({ projetId, photoUrl }: { projetId: string; photoUrl: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function save() {
    setError(null);
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choisis une image.");
      return;
    }
    const fd = new FormData();
    fd.set("photo", file);

    startTransition(async () => {
      const result = await updateProjetAnnoncePhoto(projetId, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setPreview(null);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await removeProjetAnnoncePhoto(projetId);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Photo pour les annonces</h2>
          <p className="mt-1 text-sm text-text-muted">
            Affichée comme logo sur les annonces publiques de ce projet — distincte du logo des documents.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Fermer" : photoUrl ? "Modifier" : "Ajouter"}
        </Button>
      </div>

      {!open && (
        <div className="flex items-center gap-3">
          {photoUrl ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-ink-raised-2">
              <Image src={photoUrl} alt="Photo annonces" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <p className="text-sm text-text-muted">Aucune photo pour l&apos;instant.</p>
          )}
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <div
              onClick={() => inputRef.current?.click()}
              className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-ink-raised-2"
            >
              {preview || photoUrl ? (
                <Image src={preview ?? photoUrl!} alt="Photo annonces" fill className="object-cover" unoptimized />
              ) : (
                <span className="text-center text-xs text-text-muted">+ Photo</span>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
            {photoUrl && (
              <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
                Retirer
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
