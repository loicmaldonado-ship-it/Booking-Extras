"use client";

import { useActionState, useRef, useState, useTransition, startTransition } from "react";
import Image from "next/image";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { prepareImage, ACCEPT_IMAGES } from "@/lib/media/compress-image";
import {
  ajouterReference,
  modifierReference,
  basculerReferenceVisible,
  supprimerReference,
  deplacerReference,
} from "@/lib/references/actions";
import { REFERENCE_TYPES, referenceTypeLabel, type Reference } from "@/lib/references/types";

type Etat = { error?: string; success?: boolean } | undefined;

// Formulaire d'une référence (ajout ou modification). L'affiche est réduite
// dans le navigateur avant l'envoi (limite de 4,5 Mo des fonctions Vercel,
// HEIC converti).
function ReferenceForm({
  reference,
  onDone,
}: {
  reference?: Reference;
  onDone?: () => void;
}) {
  const [affiche, setAffiche] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(reference?.afficheUrl ?? null);
  const [erreurAffiche, setErreurAffiche] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<Etat, FormData>(async (prev, fd) => {
    const res = reference ? await modifierReference(reference.id, prev, fd) : await ajouterReference(prev, fd);
    if (res?.success) {
      if (!reference) {
        formRef.current?.reset();
        setAffiche(null);
        setApercu(null);
      }
      onDone?.();
    }
    return res;
  }, undefined);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.delete("affiche_fichier");
        if (affiche) fd.set("affiche", affiche);
        startTransition(() => formAction(fd));
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]"
    >
      <label className="relative flex aspect-[2/3] w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-ink-raised-2 text-center text-xs text-text-muted hover:border-coral/60">
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob) ou affiche déjà en ligne
          <img src={apercu} alt="Affiche" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="px-2">+ Affiche (optionnelle)</span>
        )}
        <input
          type="file"
          name="affiche_fichier"
          accept={ACCEPT_IMAGES}
          className="hidden"
          onChange={async (e) => {
            const fichier = e.target.files?.[0];
            if (!fichier) return;
            setErreurAffiche(null);
            const res = await prepareImage(fichier, { maxDimension: 900, quality: 0.85, skipBelowBytes: 0 });
            if ("error" in res) {
              setErreurAffiche(res.error);
              return;
            }
            setAffiche(res.file);
            setApercu(URL.createObjectURL(res.file));
          }}
        />
      </label>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Titre" required>
            <Input name="titre" required defaultValue={reference?.titre} />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue={reference?.type ?? "film"}>
              {REFERENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Année">
            <Input type="number" name="annee" min={1950} max={2100} defaultValue={reference?.annee ?? undefined} />
          </Field>
          <Field label="Réalisation / diffuseur (optionnel)">
            <Input name="realisation" placeholder="Ex. Réal. Jane Doe · Canal+" defaultValue={reference?.realisation ?? undefined} />
          </Field>
        </div>
        {(erreurAffiche ?? state?.error) && <p className="text-sm text-danger">{erreurAffiche ?? state?.error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : reference ? "Enregistrer" : "Ajouter"}
          </Button>
          {reference && onDone && (
            <Button type="button" variant="ghost" onClick={onDone}>
              Annuler
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function ReferenceLigne({ reference, premiere, derniere }: { reference: Reference; premiere: boolean; derniere: boolean }) {
  const [edition, setEdition] = useState(false);
  const [pending, demarrer] = useTransition();

  if (edition) {
    return (
      <Card>
        <ReferenceForm reference={reference} onDone={() => setEdition(false)} />
      </Card>
    );
  }

  return (
    <Card className={reference.visible ? "flex items-center gap-4" : "flex items-center gap-4 opacity-60"}>
      <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
        {reference.afficheUrl && <Image src={reference.afficheUrl} alt="" fill sizes="56px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{reference.titre}</span>
          {!reference.visible && <Badge>Masquée</Badge>}
        </div>
        <p className="text-xs text-text-muted">
          {[referenceTypeLabel(reference.type), reference.annee, reference.realisation].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1 text-xs">
        <button type="button" disabled={premiere || pending} onClick={() => demarrer(() => deplacerReference(reference.id, "haut"))} className="rounded-full border border-border px-2 py-1 disabled:opacity-30" aria-label="Monter">
          ↑
        </button>
        <button type="button" disabled={derniere || pending} onClick={() => demarrer(() => deplacerReference(reference.id, "bas"))} className="rounded-full border border-border px-2 py-1 disabled:opacity-30" aria-label="Descendre">
          ↓
        </button>
        <button type="button" onClick={() => setEdition(true)} className="rounded-full border border-border px-3 py-1 font-medium text-text-muted hover:text-text">
          Modifier
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => demarrer(() => basculerReferenceVisible(reference.id, !reference.visible))}
          className="rounded-full border border-border px-3 py-1 font-medium text-text-muted hover:text-text"
        >
          {reference.visible ? "Masquer" : "Afficher"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Supprimer « ${reference.titre} » des références ?`)) demarrer(() => supprimerReference(reference.id));
          }}
          className="rounded-full border border-border px-3 py-1 font-medium text-danger hover:border-danger/60"
        >
          Supprimer
        </button>
      </div>
    </Card>
  );
}

export function ReferencesPanel({ references }: { references: Reference[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ajouter une référence</h2>
        <ReferenceForm />
      </Card>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Sur l&apos;accueil ({references.filter((r) => r.visible).length})</h2>
        {references.length === 0 && (
          <Card>
            <p className="text-sm text-text-muted">Aucune référence pour l&apos;instant : le bandeau n&apos;apparaît pas sur l&apos;accueil.</p>
          </Card>
        )}
        {references.map((r, i) => (
          <ReferenceLigne key={r.id} reference={r} premiere={i === 0} derniere={i === references.length - 1} />
        ))}
      </div>
    </div>
  );
}
