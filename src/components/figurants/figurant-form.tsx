"use client";

import { useActionState, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CIVILITES, GENRES, PRONOMS, type Figurant, type FigurantLien } from "@/lib/figurants/types";
import { addIndisponibilite } from "@/lib/figurants/disponibilites";

type Action = (
  prevState: unknown,
  formData: FormData
) => Promise<{ error?: string } | void>;

export function FigurantForm({
  action,
  figurant,
  liens = [],
}: {
  action: Action;
  figurant?: Figurant;
  liens?: FigurantLien[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [estComedien, setEstComedien] = useState(figurant?.est_comedien ?? false);
  const [aVehicule, setAVehicule] = useState<boolean | null>(figurant?.a_vehicule ?? null);
  const [lienRows, setLienRows] = useState(
    liens.length > 0 ? liens.map((l) => ({ label: l.label, url: l.url })) : [{ label: "", url: "" }]
  );
  const [indispoDate, setIndispoDate] = useState("");
  const [indispoPending, startIndispoTransition] = useTransition();
  const [indispoAdded, setIndispoAdded] = useState<string | null>(null);

  function addIndispo() {
    if (!figurant || !indispoDate) return;
    setIndispoAdded(null);
    startIndispoTransition(async () => {
      await addIndisponibilite(figurant.token_disponibilite, indispoDate);
      setIndispoAdded(indispoDate);
      setIndispoDate("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Card className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="est_comedien"
            checked={estComedien}
            onChange={(e) => setEstComedien(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          Comédien·ne
        </label>
        <p className="text-xs text-text-muted">
          Seul le nom est obligatoire — pratique pour créer vite un profil depuis un book ou une fiche d&apos;agence,
          avant d&apos;avoir ses coordonnées directes.
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Identité</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom" required>
            <Input name="prenom" defaultValue={figurant?.prenom} required />
          </Field>
          <Field label="Nom" required>
            <Input name="nom" defaultValue={figurant?.nom} required />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Civilité">
            <Select name="civilite" defaultValue={figurant?.civilite ?? ""}>
              <option value=""></option>
              {CIVILITES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pronom" required={!estComedien}>
            <Select name="pronom" defaultValue={figurant?.pronom ?? ""} required={!estComedien}>
              <option value=""></option>
              {PRONOMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Genre" required={!estComedien}>
            <Select name="genre" defaultValue={figurant?.genre ?? ""} required={!estComedien}>
              <option value=""></option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date de naissance">
            <Input type="date" name="date_naissance" defaultValue={figurant?.date_naissance ?? ""} />
          </Field>
          <Field label="Commune de naissance" required={!estComedien}>
            <Input name="commune_naissance" defaultValue={figurant?.commune_naissance ?? ""} required={!estComedien} />
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Adresse de résidence</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="md:col-span-2">
              <Field label="Rue et numéro" required={!estComedien}>
                <Input name="adresse" defaultValue={figurant?.adresse ?? ""} required={!estComedien} />
              </Field>
            </div>
            <Field label="Code postal" required={!estComedien}>
              <Input name="code_postal" defaultValue={figurant?.code_postal ?? ""} required={!estComedien} />
            </Field>
            <Field label="Ville" required={!estComedien}>
              <Input name="ville" defaultValue={figurant?.ville ?? ""} required={!estComedien} />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Contact</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" required={!estComedien}>
            <Input type="email" name="email" defaultValue={figurant?.email ?? ""} required={!estComedien} />
          </Field>
          <Field label="Téléphone" required={!estComedien}>
            <Input type="tel" name="telephone" defaultValue={figurant?.telephone ?? ""} required={!estComedien} />
          </Field>
        </div>
        <Field label="Où peut-il·elle loger en France ? (option)">
          <Textarea
            name="logement_france"
            placeholder="Ex. peut loger chez de la famille à Lyon et Marseille"
            defaultValue={figurant?.logement_france ?? ""}
          />
        </Field>
      </Card>

      {estComedien && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Agent</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Nom de l'agent">
              <Input name="agent_nom" defaultValue={figurant?.agent_nom ?? ""} />
            </Field>
            <Field label="Email de l'agent">
              <Input type="email" name="agent_email" defaultValue={figurant?.agent_email ?? ""} />
            </Field>
            <Field label="Téléphone de l'agent">
              <Input type="tel" name="agent_telephone" defaultValue={figurant?.agent_telephone ?? ""} />
            </Field>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Mensurations</h2>
        <p className="text-xs text-text-muted">Optionnel à la création — à compléter dès que tu as les mesures.</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Hauteur (cm)">
            <Input type="number" name="taille_cm" defaultValue={figurant?.taille_cm ?? ""} />
          </Field>
          <Field label="Poids (kg)">
            <Input type="number" name="poids_kg" defaultValue={figurant?.poids_kg ?? ""} />
          </Field>
          <Field label="Veste">
            <Input name="veste" placeholder="Ex. 48/50" defaultValue={figurant?.veste ?? ""} />
          </Field>
          <Field label="Pantalon">
            <Input name="pantalon" placeholder="Ex. 42" defaultValue={figurant?.pantalon ?? ""} />
          </Field>
          <Field label="Tour de tête (cm)">
            <Input type="number" name="tour_tete_cm" defaultValue={figurant?.tour_tete_cm ?? ""} />
          </Field>
          <Field label="Tour de cou (cm)">
            <Input type="number" name="tour_cou_cm" defaultValue={figurant?.tour_cou_cm ?? ""} />
          </Field>
          <Field label="Tour de poitrine (cm)">
            <Input type="number" name="tour_poitrine_cm" defaultValue={figurant?.tour_poitrine_cm ?? ""} />
          </Field>
          <Field label="Tour de taille (cm)">
            <Input type="number" name="tour_taille_cm" defaultValue={figurant?.tour_taille_cm ?? ""} />
          </Field>
          <Field label="Tour de hanches (cm)">
            <Input type="number" name="tour_hanches_cm" defaultValue={figurant?.tour_hanches_cm ?? ""} />
          </Field>
          <Field label="Jambes ext. (cm)">
            <Input type="number" name="jambes_ext_cm" defaultValue={figurant?.jambes_ext_cm ?? ""} />
          </Field>
          <Field label="Jambes int. (cm)">
            <Input type="number" name="jambes_int_cm" defaultValue={figurant?.jambes_int_cm ?? ""} />
          </Field>
          <Field label="Pointure">
            <Input type="number" step="0.5" name="pointure" defaultValue={figurant?.pointure ?? ""} />
          </Field>
          <Field label="Gant">
            <Input name="gant" defaultValue={figurant?.gant ?? ""} />
          </Field>
          <Field label="Carrure (cm)">
            <Input type="number" name="carrure_cm" defaultValue={figurant?.carrure_cm ?? ""} />
          </Field>
          <Field label="Couleur des yeux">
            <Input name="couleur_yeux" defaultValue={figurant?.couleur_yeux ?? ""} />
          </Field>
          <Field label="Couleur des cheveux">
            <Input name="couleur_cheveux" defaultValue={figurant?.couleur_cheveux ?? ""} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Véhicule</h2>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">A un véhicule ?</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="a_vehicule"
                value="oui"
                defaultChecked={figurant?.a_vehicule === true}
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
                defaultChecked={figurant?.a_vehicule === false}
                onChange={() => setAVehicule(false)}
                className="accent-coral"
              />
              Non
            </label>
          </div>
        </div>
        {aVehicule && (
          <>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="vehicule_velo"
                  defaultChecked={figurant?.vehicule_velo}
                  className="h-4 w-4 rounded border-border accent-coral"
                />
                Vélo
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="vehicule_moto"
                  defaultChecked={figurant?.vehicule_moto}
                  className="h-4 w-4 rounded border-border accent-coral"
                />
                Moto
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="vehicule_scooter"
                  defaultChecked={figurant?.vehicule_scooter}
                  className="h-4 w-4 rounded border-border accent-coral"
                />
                Scooter
              </label>
            </div>
            <Field label="Marque">
              <Input name="vehicule_marque" defaultValue={figurant?.vehicule_marque ?? ""} />
            </Field>
            {figurant && (
              <p className="text-xs text-text-muted">
                Ajoute la photo du véhicule depuis{" "}
                <a href={`/figurants/${figurant.id}`} className="text-coral hover:underline">
                  la fiche du profil
                </a>
                .
              </p>
            )}
          </>
        )}
      </Card>

      {figurant ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Photos</h2>
          <p className="text-sm text-text-muted">
            Gère les photos depuis <a href={`/figurants/${figurant.id}`} className="text-coral hover:underline">la fiche du profil</a>,
            une par une (plus fiable pour les grosses photos de téléphone).
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Photo</h2>
          <Field label="Portrait" required={!estComedien}>
            <input
              type="file"
              name="photo_portrait"
              accept="image/*"
              required={!estComedien}
              className="text-sm text-text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-ink-raised-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text"
            />
          </Field>
          <p className="text-xs text-text-muted">Les autres photos (pied, selfie...) se gèrent depuis la fiche une fois le profil créé.</p>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Liens</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setLienRows((rows) => [...rows, { label: "", url: "" }])}
          >
            + Ajouter un lien
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {lienRows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <Input
                name="lien_label"
                placeholder="Bande démo, Instagram..."
                defaultValue={row.label}
              />
              <Input name="lien_url" placeholder="https://..." defaultValue={row.url} />
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Suivi interne</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="compte_myrole"
            defaultChecked={figurant?.compte_myrole}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          Compte Myrole créé
        </label>
        <Field label="Tags (séparés par des virgules)">
          <Input name="tags" defaultValue={figurant?.tags?.join(", ") ?? ""} />
        </Field>
        <Field label="Notes internes">
          <Textarea name="notes_internes" defaultValue={figurant?.notes_internes ?? ""} />
        </Field>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : figurant ? "Enregistrer" : "Créer le profil"}
        </Button>
      </div>
    </form>

    {figurant && (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Indisponibilité</h2>
        <p className="text-sm text-text-muted">
          Ajoute rapidement une date où {figurant.prenom} n&apos;est pas disponible.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={indispoDate}
            onChange={(e) => setIndispoDate(e.target.value)}
            disabled={indispoPending}
            className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
          />
          <Button type="button" variant="secondary" disabled={indispoPending || !indispoDate} onClick={addIndispo}>
            {indispoPending ? "Ajout..." : "Ajouter"}
          </Button>
          {indispoAdded && <span className="text-xs text-turquoise">Ajouté : {indispoAdded}</span>}
        </div>
      </Card>
    )}
    </div>
  );
}
