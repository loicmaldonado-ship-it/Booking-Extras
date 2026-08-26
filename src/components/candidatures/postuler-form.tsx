"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { postulerAnnonce } from "@/lib/candidatures/actions";
import { formatDateShort } from "@/lib/format-date";
import { CONTACT_RGPD_EMAIL } from "@/lib/legal/contact";
import { GENRES, PRONOMS } from "@/lib/figurants/types";
import type { AnnonceQuestion } from "@/lib/annonces/questions";
import type { AnnonceDate } from "@/lib/annonces/dates";

const REQUIRED_PHOTO_SLOTS = [
  { name: "photo_portrait", label: "Portrait" },
  { name: "photo_pied", label: "Photo en pied" },
  { name: "photo_selfie", label: "Selfie récent" },
] as const;

const MAX_EXTRA_PHOTOS = 4; // 3 obligatoires + 4 = 7 photos maximum

function PhotoSlot({
  name,
  label,
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
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
          required={required}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </div>
      <span className="text-center text-xs text-text-muted">
        {label}
        {required ? " *" : ""}
      </span>
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
    adresse: string | null;
    code_postal: string | null;
    commune_naissance: string | null;
    date_naissance: string | null;
    lien_bande_demo?: string | null;
    taille_cm?: number | null;
    poids_kg?: number | null;
    pointure?: number | null;
    veste?: string | null;
    pantalon?: string | null;
    genre?: string | null;
    pronom?: string | null;
  };
  bandeDemoObligatoire?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    postulerAnnonce.bind(null, publicToken),
    undefined
  );
  const [aVehicule, setAVehicule] = useState<boolean | null>(null);
  const today = new Date().toISOString().slice(0, 10);

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
          <Field label="Date de naissance" required>
            <Input type="date" name="date_naissance" required defaultValue={prefill?.date_naissance ?? undefined} />
          </Field>
          <Field label="Commune de naissance" required>
            <Input name="commune_naissance" required defaultValue={prefill?.commune_naissance ?? undefined} />
          </Field>
          <Field label="Genre" required>
            <Select name="genre" required defaultValue={prefill?.genre ?? ""}>
              <option value="" disabled></option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pronom" required>
            <Select name="pronom" required defaultValue={prefill?.pronom ?? ""}>
              <option value="" disabled></option>
              {PRONOMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Adresse de résidence</span>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rue et numéro" required>
              <Input name="adresse" required defaultValue={prefill?.adresse ?? undefined} />
            </Field>
            <Field label="Code postal" required>
              <Input name="code_postal" required defaultValue={prefill?.code_postal ?? undefined} />
            </Field>
            <Field label="Ville" required>
              <Input name="ville" required defaultValue={prefill?.ville ?? undefined} />
            </Field>
          </div>
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
            <Field label="Taille de veste" required>
              <Input name="veste" placeholder="Ex. 48/50" required defaultValue={prefill?.veste ?? undefined} />
            </Field>
            <Field label="Taille de pantalon" required>
              <Input name="pantalon" placeholder="Ex. 42" required defaultValue={prefill?.pantalon ?? undefined} />
            </Field>
          </div>
        </div>
        <label className="flex items-start gap-2.5 rounded-xl border border-border bg-ink px-3 py-2.5 text-sm">
          <input type="checkbox" name="temporaire" className="mt-0.5 h-4 w-4 rounded border-border accent-coral" />
          <span>
            Je ne fais de la figuration que pour ce tournage.
            <span className="mt-0.5 block text-xs text-text-muted">
              Ton profil sera automatiquement supprimé une fois ce projet terminé et archivé.
            </span>
          </span>
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted">As-tu un véhicule ? *</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="a_vehicule"
                value="oui"
                required
                onChange={() => setAVehicule(true)}
                className="accent-coral"
              />
              Oui
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="a_vehicule"
                value="non"
                required
                onChange={() => setAVehicule(false)}
                className="accent-coral"
              />
              Non
            </label>
          </div>
          {aVehicule && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-ink px-3 py-3">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="vehicule_velo" className="h-4 w-4 rounded border-border accent-coral" />
                  Vélo
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="vehicule_moto" className="h-4 w-4 rounded border-border accent-coral" />
                  Moto
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="vehicule_scooter"
                    className="h-4 w-4 rounded border-border accent-coral"
                  />
                  Scooter
                </label>
              </div>
              <Field label="Marque du véhicule" required>
                <Input name="vehicule_marque" required />
              </Field>
              <div className="w-24">
                <PhotoSlot name="photo_vehicule" label="Photo du véhicule" />
              </div>
            </div>
          )}
        </div>

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
            Photos — 3 obligatoires, jusqu&apos;à 7 au total
          </span>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {REQUIRED_PHOTO_SLOTS.map((slot) => (
              <PhotoSlot key={slot.name} name={slot.name} label={slot.label} required />
            ))}
            {Array.from({ length: MAX_EXTRA_PHOTOS }).map((_, i) => (
              <PhotoSlot key={`extra-${i}`} name="photo_extra" label="Autre (optionnel)" />
            ))}
          </div>
          <div className="mt-3">
            <Field label="Date du selfie" required>
              <Input type="date" name="selfie_date" required max={today} defaultValue={today} />
            </Field>
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
