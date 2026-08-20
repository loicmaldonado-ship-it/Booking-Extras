"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateMaFiche } from "@/lib/candidats/actions";
import type { Figurant } from "@/lib/figurants/types";

export function MaFicheForm({
  figurant,
  lienBandeDemo,
  lienInstagram,
}: {
  figurant: Figurant;
  lienBandeDemo: string | null;
  lienInstagram: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateMaFiche(undefined, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setJustSaved(true);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ma fiche</h2>
          <button
            type="button"
            onClick={() => {
              setJustSaved(false);
              setEditing(true);
            }}
            className="text-xs text-coral hover:underline"
          >
            Modifier
          </button>
        </div>
        {justSaved && <p className="text-xs text-turquoise">Vos infos ont bien été mises à jour.</p>}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-text-muted">Email : </span>
            {figurant.email ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Téléphone : </span>
            {figurant.telephone ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Ville : </span>
            {figurant.ville ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Adresse : </span>
            {figurant.adresse ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Taille : </span>
            {figurant.taille_cm ? `${figurant.taille_cm} cm` : "—"}
          </div>
          <div>
            <span className="text-text-muted">Poids : </span>
            {figurant.poids_kg ? `${figurant.poids_kg} kg` : "—"}
          </div>
          <div>
            <span className="text-text-muted">Pointure : </span>
            {figurant.pointure ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Veste / Pantalon : </span>
            {figurant.veste ?? "—"} / {figurant.pantalon ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Bande démo : </span>
            {lienBandeDemo ? (
              <a href={lienBandeDemo} target="_blank" rel="noreferrer" className="text-coral hover:underline">
                Voir le lien
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-text-muted">Instagram : </span>
            {lienInstagram ? (
              <a href={lienInstagram} target="_blank" rel="noreferrer" className="text-coral hover:underline">
                Voir le lien
              </a>
            ) : (
              "—"
            )}
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Une autre info à corriger ? Répondez-nous directement dans la messagerie ci-dessous.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Ma fiche</h2>
      <form action={save} className="flex flex-col gap-3">
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" required>
            <Input type="email" name="email" required defaultValue={figurant.email ?? ""} />
          </Field>
          <Field label="Téléphone" required>
            <Input type="tel" name="telephone" required defaultValue={figurant.telephone ?? ""} />
          </Field>
          <Field label="Ville">
            <Input name="ville" defaultValue={figurant.ville ?? ""} />
          </Field>
          <Field label="Adresse">
            <Input name="adresse" defaultValue={figurant.adresse ?? ""} />
          </Field>
          <Field label="Taille (cm)">
            <Input type="number" name="taille_cm" defaultValue={figurant.taille_cm ?? ""} />
          </Field>
          <Field label="Poids (kg)">
            <Input type="number" name="poids_kg" defaultValue={figurant.poids_kg ?? ""} />
          </Field>
          <Field label="Pointure">
            <Input type="number" step="0.5" name="pointure" defaultValue={figurant.pointure ?? ""} />
          </Field>
          <Field label="Veste">
            <Input name="veste" defaultValue={figurant.veste ?? ""} />
          </Field>
          <Field label="Pantalon">
            <Input name="pantalon" defaultValue={figurant.pantalon ?? ""} />
          </Field>
          <Field label="Lien bande démo">
            <Input type="url" name="lien_bande_demo" placeholder="https://..." defaultValue={lienBandeDemo ?? ""} />
          </Field>
          <Field label="Lien Instagram">
            <Input type="url" name="lien_instagram" placeholder="https://instagram.com/..." defaultValue={lienInstagram ?? ""} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Annuler
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
