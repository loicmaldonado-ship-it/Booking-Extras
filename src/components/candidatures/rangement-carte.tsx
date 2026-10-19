"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { setCandidatureOnglet } from "@/lib/candidatures/actions";
import { creerEtiquette, setEtiquette, type Etiquette } from "@/lib/candidatures/etiquettes";
import { emojiOnglet } from "@/lib/candidatures/onglets-affichage";
import type { CandidatureOnglet } from "@/lib/candidatures/types";

const pastille = "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50";

// Sur chaque carte : la place actuelle du profil (un tap pour la changer) et
// ses étiquettes (Vélo, Gueules…, à ajouter ou retirer sans le déplacer).
// Les menus s'ouvrent dans la carte, pas en bulle : rien n'est coupé sur
// iPad ni dans le tableau.
export function RangementCarte({
  candidatureId,
  annonceId,
  ongletId,
  onglets,
  etiquettes,
  poses,
}: {
  candidatureId: string;
  annonceId: string;
  ongletId: string | null;
  onglets: CandidatureOnglet[];
  etiquettes: Etiquette[];
  poses: string[];
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState<"place" | "etiquettes" | null>(null);
  const [pending, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState("");
  const [localesPoses, setLocalesPoses] = useState(poses);
  const [clePoses, setClePoses] = useState(poses.join(","));
  if (clePoses !== poses.join(",")) {
    setClePoses(poses.join(","));
    setLocalesPoses(poses);
  }

  const place = ongletId ? onglets.find((o) => o.id === ongletId) : null;
  const rangeables = onglets.filter((o) => !o.fixe);
  const posees = etiquettes.filter((e) => localesPoses.includes(e.id));

  function ranger(id: string | null) {
    setErreur(null);
    demarrer(async () => {
      const res = await setCandidatureOnglet(candidatureId, id);
      if (res?.error) setErreur(res.error);
      else setOuvert(null);
      router.refresh();
    });
  }

  function basculer(e: Etiquette) {
    const pose = !localesPoses.includes(e.id);
    setErreur(null);
    setLocalesPoses((l) => (pose ? [...l, e.id] : l.filter((x) => x !== e.id)));
    demarrer(async () => {
      const res = await setEtiquette(candidatureId, e.id, pose);
      if (res.error) {
        setErreur(res.error);
        setLocalesPoses((l) => (pose ? l.filter((x) => x !== e.id) : [...l, e.id]));
        return;
      }
      router.refresh();
    });
  }

  function creer() {
    const nom = nouveau.trim();
    if (!nom) return;
    setErreur(null);
    demarrer(async () => {
      const cree = await creerEtiquette(annonceId, nom);
      if (cree.error || !cree.etiquette) {
        setErreur(cree.error ?? "Création impossible.");
        return;
      }
      const res = await setEtiquette(candidatureId, cree.etiquette.id, true);
      if (res.error) {
        setErreur(res.error);
        return;
      }
      setLocalesPoses((l) => (l.includes(cree.etiquette!.id) ? l : [...l, cree.etiquette!.id]));
      setNouveau("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => setOuvert(ouvert === "place" ? null : "place")}
          aria-expanded={ouvert === "place"}
          title="Changer de place"
          className={cn(pastille, ouvert === "place" ? "border-coral bg-coral/15 text-coral" : "border-border-strong bg-ink text-text hover:border-text")}
        >
          📍 {place ? `${emojiOnglet(place)} ${place.nom}` : "À trier"} ▾
        </button>
        {posees.map((e) => (
          <button
            key={e.id}
            type="button"
            disabled={pending}
            onClick={() => basculer(e)}
            title="Retirer cette étiquette"
            className={cn(pastille, "border-turquoise bg-turquoise/15 text-turquoise hover:bg-turquoise/25")}
          >
            🏷️ {e.nom} ×
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOuvert(ouvert === "etiquettes" ? null : "etiquettes")}
          aria-expanded={ouvert === "etiquettes"}
          title="Ajouter une étiquette"
          className={cn(
            pastille,
            "border-dashed",
            ouvert === "etiquettes" ? "border-coral bg-coral/15 text-coral" : "border-border-strong bg-ink text-text hover:border-text"
          )}
        >
          ＋ Étiquette
        </button>
      </div>

      {ouvert === "place" && (
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-ink p-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => ranger(null)}
            className={cn(pastille, ongletId === null ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:border-text")}
          >
            📥 À trier
          </button>
          {rangeables.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={pending}
              onClick={() => ranger(o.id)}
              className={cn(pastille, ongletId === o.id ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:border-text")}
            >
              {emojiOnglet(o)} {o.nom}
            </button>
          ))}
        </div>
      )}

      {ouvert === "etiquettes" && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-ink p-1.5">
          {etiquettes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {etiquettes.map((e) => {
                const on = localesPoses.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    disabled={pending}
                    onClick={() => basculer(e)}
                    aria-pressed={on}
                    className={cn(pastille, on ? "border-turquoise bg-turquoise/15 text-turquoise" : "border-border-strong text-text hover:border-text")}
                  >
                    {on ? "✓ " : ""}
                    {e.nom}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1">
            <input
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  creer();
                }
              }}
              placeholder="Nouvelle étiquette (ex. Vélo)"
              maxLength={40}
              className="min-w-0 flex-1 rounded-lg border border-border-strong bg-ink px-2 py-1 text-xs outline-none focus:border-coral"
            />
            <button
              type="button"
              disabled={pending || !nouveau.trim()}
              onClick={creer}
              className="rounded-full border border-text px-2.5 py-1 text-xs font-semibold text-coral disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
      {erreur && <p className="text-[11px] text-danger">{erreur}</p>}
    </div>
  );
}
