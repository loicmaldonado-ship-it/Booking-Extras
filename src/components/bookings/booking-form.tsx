"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";
import { STATUTS, type Booking, type BookingStatut } from "@/lib/bookings/types";
import type { BaremeCachet } from "@/lib/bareme/types";

type Action = (
  prevState: unknown,
  formData: FormData
) => Promise<{ error?: string } | void>;

export function BookingForm({
  action,
  booking,
  figurants,
  projets,
  bareme,
  defaultFigurantId,
  defaultProjetId,
  defaultDate,
}: {
  action: Action;
  booking?: Booking;
  figurants: { id: string; prenom: string; nom: string }[];
  projets: { id: string; nom: string; convention: string | null }[];
  bareme: BaremeCachet[];
  defaultFigurantId?: string;
  defaultProjetId?: string;
  defaultDate?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [statut, setStatut] = useState<BookingStatut>(booking?.statut ?? "envoyé");
  const [cachet, setCachet] = useState<Cachet | "">(booking?.cachet ?? "");
  const [covoiturageRole, setCovoiturageRole] = useState(booking?.covoiturage_role ?? "");
  const [projetId, setProjetId] = useState(booking?.projet_id ?? defaultProjetId ?? "");

  const selectedProjet = projets.find((p) => p.id === projetId);
  const tarifRef = bareme.find(
    (b) => b.cachet === cachet && b.convention === selectedProjet?.convention
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Booking</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Figurant" required>
            <Select name="figurant_id" defaultValue={booking?.figurant_id ?? defaultFigurantId ?? ""} required>
              <option value=""></option>
              {figurants.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.prenom} {f.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Projet" required>
            <Select
              name="projet_id"
              value={projetId}
              onChange={(e) => setProjetId(e.target.value)}
              required
            >
              <option value=""></option>
              {projets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required>
            <Input type="date" name="date" defaultValue={booking?.date ?? defaultDate ?? ""} required />
          </Field>
          <Field label="Heure de convocation">
            <Input type="time" name="heure_convocation" defaultValue={booking?.heure_convocation ?? "08:00"} />
          </Field>
          <Field label="Fonction">
            <Input
              name="fonction"
              placeholder="Passant, boulangère..."
              defaultValue={booking?.fonction ?? ""}
            />
          </Field>
          <Field label="Cachet">
            <Select
              name="cachet"
              value={cachet}
              onChange={(e) => setCachet(e.target.value as Cachet | "")}
            >
              <option value=""></option>
              {CACHETS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {tarifRef && (
          <p className="text-xs text-text-muted">
            Tarif de référence ({tarifRef.convention}) : {tarifRef.montant_brut.toFixed(2)} € brut
            — pour le bordereau, pas de calcul de majoration ici.
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Statut</h2>
        <Field label="Statut">
          <Select
            name="statut"
            value={statut}
            onChange={(e) => setStatut(e.target.value as BookingStatut)}
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="convocation_envoyee"
              defaultChecked={booking?.convocation_envoyee}
              className="h-4 w-4 rounded border-border accent-coral"
            />
            Convocation envoyée
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="lien_myrole_envoye"
              defaultChecked={booking?.lien_myrole_envoye}
              className="h-4 w-4 rounded border-border accent-coral"
            />
            Lien Myrole envoyé
          </label>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Covoiturage</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Rôle">
            <Select
              name="covoiturage_role"
              value={covoiturageRole ?? ""}
              onChange={(e) => setCovoiturageRole(e.target.value)}
            >
              <option value=""></option>
              <option value="conducteur">Conducteur</option>
              <option value="passager">Passager</option>
            </Select>
          </Field>
          <Field label="Lieu de départ">
            <Input name="covoiturage_lieu_depart" defaultValue={booking?.covoiturage_lieu_depart ?? ""} />
          </Field>
          {covoiturageRole === "conducteur" && (
            <Field label="Places disponibles">
              <Input
                type="number"
                name="covoiturage_places_disponibles"
                defaultValue={booking?.covoiturage_places_disponibles ?? ""}
              />
            </Field>
          )}
          {covoiturageRole === "passager" && (
            <Field label="Conducteur assigné">
              <Select name="covoiturage_conducteur_id" defaultValue={booking?.covoiturage_conducteur_id ?? ""}>
                <option value=""></option>
                {figurants.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.prenom} {f.nom}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Notes</h2>
        <Textarea name="notes" defaultValue={booking?.notes ?? ""} />
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement..." : booking ? "Enregistrer" : "Créer le booking"}
        </Button>
      </div>
    </form>
  );
}
