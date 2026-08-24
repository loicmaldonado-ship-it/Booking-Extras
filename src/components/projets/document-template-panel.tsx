"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateDocumentTemplate, removeDocumentTemplateLogo } from "@/lib/documents/template-actions";

const DEFAULT_COLOR = "#111111";

export function DocumentTemplatePanel({
  projetId,
  logoUrl,
  accentColor,
}: {
  projetId: string;
  logoUrl: string | null;
  accentColor: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(accentColor ?? DEFAULT_COLOR);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("accent_color", color);
    const file = inputRef.current?.files?.[0];
    if (file) fd.set("logo", file);

    startTransition(async () => {
      const result = await updateDocumentTemplate(projetId, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setPreview(null);
      router.refresh();
    });
  }

  function removeLogo() {
    startTransition(async () => {
      await removeDocumentTemplateLogo(projetId);
      router.refresh();
    });
  }

  const hasTemplate = logoUrl || accentColor;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Modèle de documents</h2>
          <p className="mt-1 text-sm text-text-muted">
            Logo et couleur repris automatiquement sur l&apos;entête de tous les documents générés pour ce projet
            (trombis, fiches, bordereau...).
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? "Fermer" : hasTemplate ? "Modifier" : "Calibrer"}
        </Button>
      </div>

      {!open && (
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <div className="relative h-12 w-24 overflow-hidden rounded bg-ink-raised-2">
              <Image src={logoUrl} alt="Logo" fill className="object-contain" unoptimized />
            </div>
          ) : (
            <p className="text-sm text-text-muted">Aucun modèle calibré pour l&apos;instant.</p>
          )}
          {accentColor && (
            <span className="flex items-center gap-1.5 text-sm">
              <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: accentColor }} />
              {accentColor}
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <div
              onClick={() => inputRef.current?.click()}
              className="relative flex h-16 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-ink-raised-2"
            >
              {preview || logoUrl ? (
                <Image src={preview ?? logoUrl!} alt="Logo" fill className="object-contain" unoptimized />
              ) : (
                <span className="text-center text-xs text-text-muted">+ Logo</span>
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
            {logoUrl && (
              <Button type="button" variant="ghost" disabled={pending} onClick={removeLogo}>
                Retirer le logo
              </Button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            Couleur d&apos;accent
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={pending}
              className="h-8 w-14 cursor-pointer rounded border border-border bg-transparent"
            />
            <span className="text-text-muted">{color}</span>
          </label>

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
