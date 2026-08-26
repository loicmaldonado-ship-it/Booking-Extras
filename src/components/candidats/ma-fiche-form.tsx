"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { updateMaFiche } from "@/lib/candidats/actions";
import { GENRES, PRONOMS, type Figurant } from "@/lib/figurants/types";
import { formatDateShort } from "@/lib/format-date";

// Champs obligatoires (mêmes que sur la candidature/fiche interne) — un
// profil créé avant leur ajout, ou incomplet pour une autre raison, doit
// être détecté ici pour que le candidat soit invité à les compléter dès
// qu'il revient sur son espace (notamment quand on lui renvoie le lien de
// connexion justement pour ça).
const REQUIRED_FIELDS: { key: keyof Figurant; label: string }[] = [
  { key: "genre", label: "Genre" },
  { key: "pronom", label: "Pronom" },
  { key: "adresse", label: "Adresse" },
  { key: "code_postal", label: "Code postal" },
  { key: "ville", label: "Ville" },
  { key: "commune_naissance", label: "Commune de naissance" },
  { key: "taille_cm", label: "Taille" },
  { key: "poids_kg", label: "Poids" },
  { key: "pointure", label: "Pointure" },
  { key: "veste", label: "Veste" },
  { key: "pantalon", label: "Pantalon" },
];

function missingFieldLabels(figurant: Figurant): string[] {
  return REQUIRED_FIELDS.filter((f) => !figurant[f.key]).map((f) => f.label);
}

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
  const missing = missingFieldLabels(figurant);
  const [editing, setEditing] = useState(missing.length > 0);
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
        {missing.length > 0 && (
          <div className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
            <strong>Ta fiche n&apos;est pas complète.</strong> Il manque : {missing.join(", ")}.
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Email : </span>
            {figurant.email ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Téléphone : </span>
            {figurant.telephone ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Genre : </span>
            {figurant.genre ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Pronom : </span>
            {figurant.pronom ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Date de naissance : </span>
            {figurant.date_naissance ? formatDateShort(figurant.date_naissance) : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Commune de naissance : </span>
            {figurant.commune_naissance ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Adresse : </span>
            {figurant.adresse ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Code postal : </span>
            {figurant.code_postal ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Ville : </span>
            {figurant.ville ?? "—"}
          </div>
        </div>
        <p className="mt-1 text-xs font-medium text-text-muted">Mensurations</p>
        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Taille : </span>
            {figurant.taille_cm ? `${figurant.taille_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Poids : </span>
            {figurant.poids_kg ? `${figurant.poids_kg} kg` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Pointure : </span>
            {figurant.pointure ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Veste / Pantalon : </span>
            {figurant.veste ?? "—"} / {figurant.pantalon ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Tour de tête : </span>
            {figurant.tour_tete_cm ? `${figurant.tour_tete_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Tour de cou : </span>
            {figurant.tour_cou_cm ? `${figurant.tour_cou_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Tour de poitrine : </span>
            {figurant.tour_poitrine_cm ? `${figurant.tour_poitrine_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Tour de taille : </span>
            {figurant.tour_taille_cm ? `${figurant.tour_taille_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Tour de hanches : </span>
            {figurant.tour_hanches_cm ? `${figurant.tour_hanches_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Jambes ext. : </span>
            {figurant.jambes_ext_cm ? `${figurant.jambes_ext_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Jambes int. : </span>
            {figurant.jambes_int_cm ? `${figurant.jambes_int_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Gant : </span>
            {figurant.gant ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Carrure : </span>
            {figurant.carrure_cm ? `${figurant.carrure_cm} cm` : "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Yeux : </span>
            {figurant.couleur_yeux ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Cheveux : </span>
            {figurant.couleur_cheveux ?? "—"}
          </div>
          <div className="min-w-0 break-words">
            <span className="text-text-muted">Bande démo : </span>
            {lienBandeDemo ? (
              <a href={lienBandeDemo} target="_blank" rel="noreferrer" className="text-coral hover:underline">
                Voir le lien
              </a>
            ) : (
              "—"
            )}
          </div>
          <div className="min-w-0 break-words">
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
      {missing.length > 0 && (
        <div className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">
          <strong>Merci de compléter ces informations obligatoires :</strong> {missing.join(", ")}.
        </div>
      )}
      <form action={save} className="flex flex-col gap-4">
        {error && <p className="text-xs text-danger">{error}</p>}

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Identité</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email" required>
              <Input type="email" name="email" required defaultValue={figurant.email ?? ""} />
            </Field>
            <Field label="Téléphone" required>
              <Input type="tel" name="telephone" required defaultValue={figurant.telephone ?? ""} />
            </Field>
            <Field label="Date de naissance">
              <Input type="date" name="date_naissance" defaultValue={figurant.date_naissance ?? ""} />
            </Field>
            <Field label="Commune de naissance" required>
              <Input name="commune_naissance" defaultValue={figurant.commune_naissance ?? ""} required />
            </Field>
            <Field label="Genre" required>
              <Select name="genre" defaultValue={figurant.genre ?? ""} required>
                <option value=""></option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pronom" required>
              <Select name="pronom" defaultValue={figurant.pronom ?? ""} required>
                <option value=""></option>
                {PRONOMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Adresse de résidence</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Rue et numéro" required>
              <Input name="adresse" defaultValue={figurant.adresse ?? ""} required />
            </Field>
            <Field label="Code postal" required>
              <Input name="code_postal" defaultValue={figurant.code_postal ?? ""} required />
            </Field>
            <Field label="Ville" required>
              <Input name="ville" defaultValue={figurant.ville ?? ""} required />
            </Field>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Mensurations</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Taille (cm)" required>
              <Input type="number" name="taille_cm" defaultValue={figurant.taille_cm ?? ""} required />
            </Field>
            <Field label="Poids (kg)" required>
              <Input type="number" name="poids_kg" defaultValue={figurant.poids_kg ?? ""} required />
            </Field>
            <Field label="Pointure" required>
              <Input type="number" step="0.5" name="pointure" defaultValue={figurant.pointure ?? ""} required />
            </Field>
            <Field label="Veste" required>
              <Input name="veste" defaultValue={figurant.veste ?? ""} required />
            </Field>
            <Field label="Pantalon" required>
              <Input name="pantalon" defaultValue={figurant.pantalon ?? ""} required />
            </Field>
            <Field label="Tour de tête (cm)">
              <Input type="number" name="tour_tete_cm" defaultValue={figurant.tour_tete_cm ?? ""} />
            </Field>
            <Field label="Tour de cou (cm)">
              <Input type="number" name="tour_cou_cm" defaultValue={figurant.tour_cou_cm ?? ""} />
            </Field>
            <Field label="Tour de poitrine (cm)">
              <Input type="number" name="tour_poitrine_cm" defaultValue={figurant.tour_poitrine_cm ?? ""} />
            </Field>
            <Field label="Tour de taille (cm)">
              <Input type="number" name="tour_taille_cm" defaultValue={figurant.tour_taille_cm ?? ""} />
            </Field>
            <Field label="Tour de hanches (cm)">
              <Input type="number" name="tour_hanches_cm" defaultValue={figurant.tour_hanches_cm ?? ""} />
            </Field>
            <Field label="Jambes ext. (cm)">
              <Input type="number" name="jambes_ext_cm" defaultValue={figurant.jambes_ext_cm ?? ""} />
            </Field>
            <Field label="Jambes int. (cm)">
              <Input type="number" name="jambes_int_cm" defaultValue={figurant.jambes_int_cm ?? ""} />
            </Field>
            <Field label="Gant">
              <Input name="gant" defaultValue={figurant.gant ?? ""} />
            </Field>
            <Field label="Carrure (cm)">
              <Input type="number" name="carrure_cm" defaultValue={figurant.carrure_cm ?? ""} />
            </Field>
            <Field label="Couleur des yeux">
              <Input name="couleur_yeux" defaultValue={figurant.couleur_yeux ?? ""} />
            </Field>
            <Field label="Couleur des cheveux">
              <Input name="couleur_cheveux" defaultValue={figurant.couleur_cheveux ?? ""} />
            </Field>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Liens</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lien bande démo">
              <Input type="url" name="lien_bande_demo" placeholder="https://..." defaultValue={lienBandeDemo ?? ""} />
            </Field>
            <Field label="Lien Instagram">
              <Input type="url" name="lien_instagram" placeholder="https://instagram.com/..." defaultValue={lienInstagram ?? ""} />
            </Field>
          </div>
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
