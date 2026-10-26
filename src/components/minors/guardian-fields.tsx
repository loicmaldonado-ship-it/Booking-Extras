"use client";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { ageOnDate, type GuardiansData, type Guardian } from "@/lib/minors/model";

export function GuardianFields({ birth, initial }: { birth: string; initial?: GuardiansData }) {
  const [absence, setAbsence] = useState(initial && "absence_reason" in initial.second ? initial.second.absence_reason : "");
  const age = ageOnDate(birth);
  if (age === null || age >= 18) return null;
  const fields = (position: 1 | 2, value?: Guardian) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Prénom" required><Input name={`guardian_${position}_prenom`} required maxLength={120} defaultValue={value?.prenom} /></Field>
      <Field label="Nom" required><Input name={`guardian_${position}_nom`} required maxLength={120} defaultValue={value?.nom} /></Field>
      <Field label="Adresse postale complète" required><Input name={`guardian_${position}_adresse`} required maxLength={1000} defaultValue={value?.adresse} /></Field>
      <Field label="Téléphone" required><Input type="tel" name={`guardian_${position}_telephone`} required maxLength={64} defaultValue={value?.telephone} /></Field>
      <Field label="Email personnel" required><Input type="email" name={`guardian_${position}_email`} required maxLength={254} defaultValue={value?.email} /></Field>
    </div>
  );
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4 sm:col-span-2">
      <legend className="px-1 font-semibold">Représentants légaux — moins de 18 ans</legend>
      <p className="text-sm text-text-muted">L’enfant et chacun de ses représentants doivent utiliser des adresses email différentes. Ces coordonnées sont réservées au suivi du dossier mineur.</p>
      <fieldset className="flex flex-col gap-3"><legend className="mb-2 font-medium">Représentant légal 1</legend>{fields(1, initial?.first)}</fieldset>
      <fieldset className="flex flex-col gap-3"><legend className="mb-2 font-medium">Représentant légal 2</legend>
        <Field label="Situation du second représentant">
          <Select name="guardian_2_absence_reason" value={absence} onChange={e => setAbsence(e.target.value as typeof absence)}>
            <option value="">Ses coordonnées sont renseignées ci-dessous</option>
            <option value="decede">Décédé·e</option>
            <option value="sans_autorite">N’exerce plus l’autorité parentale</option>
          </Select>
        </Field>
        {!absence && fields(2, initial && !("absence_reason" in initial.second) ? initial.second : undefined)}
      </fieldset>
    </fieldset>
  );
}
