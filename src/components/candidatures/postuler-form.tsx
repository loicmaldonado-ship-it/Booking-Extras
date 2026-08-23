"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { postulerAnnonce } from "@/lib/candidatures/actions";
import { formatDateShort } from "@/lib/format-date";
import { CONTACT_RGPD_EMAIL } from "@/lib/legal/contact";
import type { AnnonceQuestion } from "@/lib/annonces/questions";
import type { AnnonceDate } from "@/lib/annonces/dates";

const PHOTO_SLOTS = ["photo_1", "photo_2", "photo_3"] as const;

function PhotoSlot({ name, label }: { name: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onClick={() => inputRef.current?.click()}
        className="relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-border bg-ink-raised-2 transition-colors hover:border-coral/60"
      >
        {preview ? (
          <Image src={preview} alt={label} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-text-muted">
            <span className="text-lg">+</span>
            <span>Ajouter</span>
          </div>
        )}
        {preview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-sm text-text hover:bg-danger hover:text-ink"
          >
            ×
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </div>
      <span className="text-center text-xs text-text-muted">{label}</span>
    </div>
  );
}

export function PostulerForm({
  publicToken,
  questions,
  dates,
  prefill,
  bandeDemoObligatoire = false,
}: {
  publicToken: string;
  questions: AnnonceQuestion[];
  dates: AnnonceDate[];
  prefill?: {
    prenom: string;
    nom: string;
    email: string;
    telephone: string | null;
    ville: string | null;
    date_naissance: string | null;
    lien_bande_demo?: string | null;
    taille_cm?: number | null;
    poids_kg?: number | null;
    pointure?: number | null;
  };
  bandeDemoObligatoire?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    postulerAnnonce.bind(null, publicToken),
    undefined
  );

  if (state?.success) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-turquoise">Candidature envoyée</h2>
        <p className="text-sm text-text-muted">
          Merci ! Ta candidature a bien été enregistrée. On te recontacte si ton profil correspond.
        </p>
      </Card>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}
      {prefill && (
        <div className="rounded-xl border border-turquoise/40 bg-turquoise/10 px-4 py-3 text-sm text-turquoise">
          Vos infos sont pré-remplies depuis votre espace. Vérifiez-les et modifiez-les si besoin.
        </div>
      )}
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prénom" required>
            <Input name="prenom" required defaultValue={prefill?.prenom} />
          </Field>
          <Field label="Nom" required>
            <Input name="nom" required defaultValue={prefill?.nom} />
          </Field>
          <Field label="Email" required>
            <Input type="email" name="email" required defaultValue={prefill?.email} />
          </Field>
          <Field label="Téléphone" required>
            <Input type="tel" name="telephone" required defaultValue={prefill?.telephone ?? undefined} />
          </Field>
          <Field label="Ville" required>
            <Input name="ville" required defaultValue={prefill?.ville ?? undefined} />
          </Field>
          <Field label="Date de naissance" required>
            <Input type="date" name="date_naissance" required defaultValue={prefill?.date_naissance ?? undefined} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Mensurations</span>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Taille (cm)" required>
              <Input type="number" name="taille_cm" required min={0} defaultValue={prefill?.taille_cm ?? undefined} />
            </Field>
            <Field label="Poids (kg)" required>
              <Input type="number" name="poids_kg" required min={0} defaultValue={prefill?.poids_kg ?? undefined} />
            </Field>
            <Field label="Pointure" required>
              <Input type="number" name="pointure" required min={0} defaultValue={prefill?.pointure ?? undefined} />
            </Field>
          </div>
        </div>
        <label className="flex items-start gap-2.5 rounded-xl border border-border bg-ink px-3 py-2.5 text-sm">
          <input type="checkbox" name="temporaire" className="mt-0.5 h-4 w-4 rounded border-border accent-coral" />
          <span>
            Je ne fais de la figuration que pour ce tournage (un rôle « soi-même » — éboueur, chauffeur...), pas
            de façon récurrente.
            <span className="mt-0.5 block text-xs text-text-muted">
              Ton profil sera automatiquement supprimé une fois ce projet terminé et archivé.
            </span>
          </span>
        </label>
        <Field label="Message" required>
          <Textarea
            name="message"
            required
            placeholder="Disponibilités, motivation, précisions..."
          />
        </Field>
        <Field label={`Lien bande démo${bandeDemoObligatoire ? "" : " (optionnel)"}`} required={bandeDemoObligatoire}>
          <Input
            type="url"
            name="lien_bande_demo"
            required={bandeDemoObligatoire}
            placeholder="https://..."
            defaultValue={prefill?.lien_bande_demo ?? undefined}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">
            Photos (optionnel, mais ça aide beaucoup !)
          </span>
          <div className="grid grid-cols-3 gap-3">
            {PHOTO_SLOTS.map((name, i) => (
              <PhotoSlot key={name} name={name} label={i === 0 ? "Portrait" : "Autre"} />
            ))}
          </div>
        </div>
      </Card>

      {questions.length > 0 && (
        <Card className="flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-2">
              <span className="text-sm font-medium">{q.label}</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`question_${q.id}`} value="oui" required className="accent-coral" />
                  Oui
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`question_${q.id}`} value="non" required className="accent-coral" />
                  Non
                </label>
              </div>
            </div>
          ))}
        </Card>
      )}

      {dates.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-text-muted">Disponibilités</h2>
          {dates.map((d) => (
            <div key={d.id} className="flex flex-col gap-2">
              <span className="text-sm font-medium">{formatDateShort(d.date)}</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`date_${d.id}`} value="oui" required className="accent-turquoise" />
                  Disponible
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`date_${d.id}`} value="non" required className="accent-coral" />
                  Pas disponible
                </label>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Envoi..." : "Postuler"}
      </Button>

      <p className="text-center text-xs text-text-muted">
        Candidater est gratuit — aucune somme d&apos;argent ni aucun document de paie ne vous sera jamais demandé
        sur Booking Extras.
      </p>

      <p className="text-center text-xs text-text-muted">
        Les informations de ce formulaire (dont vos photos) sont destinées à l&apos;équipe de casting Booking Extras
        pour étudier votre candidature et vous recontacter si votre profil correspond à un tournage. Elles sont
        conservées 2 ans maximum sans nouveau contact, puis supprimées. Vous pouvez à tout moment demander à les
        consulter, les corriger ou les supprimer en écrivant à {CONTACT_RGPD_EMAIL}.{" "}
        <Link href="/confidentialite" target="_blank" className="text-coral hover:underline">
          En savoir plus →
        </Link>
      </p>
    </form>
  );
}
