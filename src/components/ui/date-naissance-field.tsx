"use client";

import { useState } from "react";
import { Field, Select } from "@/components/ui/field";

const MOIS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function daysInMonth(year: number | null, month: number | null): number {
  if (!month) return 31;
  return new Date(year ?? 2001, month, 0).getDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Un <input type="date"> oblige à remonter un calendrier/molette jusqu'à la
// bonne année pour une date de naissance, souvent lointaine — pénible sur
// mobile (signalé par une candidate). Trois menus déroulants jour/mois/année
// permettent de sauter directement à la bonne valeur. Le jour se limite au
// nombre de jours réel du mois/année sélectionnés (28/29/30/31). La valeur
// combinée part dans un input caché au format ISO (YYYY-MM-DD), pour que le
// reste du formulaire (FormData, Server Actions) n'ait rien à changer.
export function DateNaissanceField({
  name,
  label = "Date de naissance",
  required,
  defaultValue,
}: {
  name: string;
  label?: string;
  required?: boolean;
  defaultValue?: string | null;
}) {
  const initial = defaultValue ? defaultValue.split("-").map(Number) : null;
  const [year, setYear] = useState<number | null>(initial?.[0] ?? null);
  const [month, setMonth] = useState<number | null>(initial?.[1] ?? null);
  const [day, setDay] = useState<number | null>(initial?.[2] ?? null);

  const maxDay = daysInMonth(year, month);
  const clampedDay = day && day > maxDay ? maxDay : day;

  const value = year && month && clampedDay ? `${year}-${pad(month)}-${pad(clampedDay)}` : "";

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);

  return (
    <Field label={label} required={required}>
      <input type="hidden" name={name} value={value} />
      <div className="grid grid-cols-3 gap-2">
        <Select
          aria-label="Jour de naissance"
          value={clampedDay ?? ""}
          onChange={(e) => setDay(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Jour</option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Mois de naissance"
          value={month ?? ""}
          onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Mois</option>
          {MOIS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Année de naissance"
          value={year ?? ""}
          onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Année</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
    </Field>
  );
}
