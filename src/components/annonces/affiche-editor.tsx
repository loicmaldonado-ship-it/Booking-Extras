"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import {
  AFFICHE_COULEURS,
  AFFICHE_POLICES,
  normalizeAfficheCouleur,
  normalizeAffichePolice,
  type AffichePolice,
} from "@/lib/annonces/affiche";
import { AFFICHE_FONT_CLASS } from "./affiche-fonts";

// Couleur et police de l'affiche, envoyées avec le formulaire (champs
// cachés), et aperçu de l'affiche recalculé à chaque modification du
// formulaire : titre, description, date, lieu, couleur, police. L'aperçu
// n'enregistre rien.
export function AfficheEditor({
  annonceId,
  formRef,
  initialCouleur,
  initialPolice,
}: {
  annonceId?: string;
  formRef: RefObject<HTMLFormElement | null>;
  initialCouleur: string | null;
  initialPolice: string | null;
}) {
  const [couleur, setCouleur] = useState<string | null>(normalizeAfficheCouleur(initialCouleur));
  const [police, setPolice] = useState<AffichePolice>(normalizeAffichePolice(initialPolice) ?? "space-grotesk");
  const [version, setVersion] = useState(0);
  const [apercu, setApercu] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !annonceId) return;
    const onInput = () => setVersion((v) => v + 1);
    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
  }, [formRef, annonceId]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || !annonceId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const fd = new FormData(form);
      setChargement(true);
      setErreur(null);
      try {
        const res = await fetch(`/annonces/${annonceId}/poster`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titre: fd.get("titre"),
            description: fd.get("description"),
            date_recherchee: fd.get("date_recherchee"),
            lieu: fd.get("lieu"),
            couleur,
            police,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error();
        const url = URL.createObjectURL(await res.blob());
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setApercu(url);
      } catch {
        if (!controller.signal.aborted) setErreur("Aperçu indisponible pour le moment.");
      } finally {
        if (!controller.signal.aborted) setChargement(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [formRef, annonceId, couleur, police, version]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const couleurPerso = couleur && !AFFICHE_COULEURS.some((c) => c.hex === couleur) ? couleur : null;

  return (
    <Card className="flex flex-col gap-4">
      <input type="hidden" name="affiche_couleur" value={couleur ?? ""} />
      <input type="hidden" name="affiche_police" value={police} />
      <h2 className="text-lg font-semibold">Affiche</h2>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-text-muted">Couleur</span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCouleur(null)}
            aria-pressed={couleur === null}
            title="Style d'origine : corail sans photo, voile noir"
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-medium",
              couleur === null ? "border-coral text-coral ring-2 ring-coral/40" : "border-border text-text-muted hover:text-text"
            )}
          >
            Origine
          </button>
          {AFFICHE_COULEURS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setCouleur(c.hex)}
              aria-pressed={couleur === c.hex}
              aria-label={c.label}
              title={c.label}
              className={cn(
                "h-8 w-8 rounded-full border border-border",
                couleur === c.hex && "ring-2 ring-coral ring-offset-2 ring-offset-ink-raised"
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <label
            title="Autre couleur"
            className={cn(
              "relative flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
              couleurPerso ? "border-coral text-coral ring-2 ring-coral/40" : "border-border text-text-muted hover:text-text"
            )}
          >
            <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: couleurPerso ?? "#888888" }} />
            Autre…
            <input
              type="color"
              value={couleurPerso ?? "#888888"}
              onChange={(e) => setCouleur(normalizeAfficheCouleur(e.target.value))}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="text-xs text-text-muted">
          La couleur teinte le bas de l&apos;affiche (et tout le fond sans photo). Le texte passe en blanc ou en noir selon
          ce qui se lit le mieux.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-text-muted">Police du titre</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AFFICHE_POLICES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPolice(p.key)}
              aria-pressed={police === p.key}
              className={cn(
                "flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors",
                police === p.key ? "border-coral bg-coral/10" : "border-border hover:border-coral/60"
              )}
            >
              <span className={cn("text-xl leading-tight", AFFICHE_FONT_CLASS[p.key])}>{p.label}</span>
              <span className="text-xs text-text-muted">{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="flex items-center justify-between text-xs font-medium text-text-muted">
          Aperçu
          {chargement && <span className="font-normal">Mise à jour…</span>}
        </span>
        {annonceId ? (
          <div className="overflow-hidden rounded-xl border border-border bg-ink-raised-2">
            {apercu ? (
              // eslint-disable-next-line @next/next/no-img-element -- image générée à la volée (blob), pas optimisable
              <img
                src={apercu}
                alt="Aperçu de l'affiche"
                className={cn("block w-full transition-opacity", chargement && "opacity-60")}
              />
            ) : (
              <p className="px-4 py-10 text-center text-xs text-text-muted">Chargement de l&apos;aperçu…</p>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-text-muted">
            L&apos;aperçu apparaît une fois l&apos;annonce créée. La couleur et la police choisies ici seront appliquées.
          </p>
        )}
        {erreur && <p className="text-xs text-danger">{erreur}</p>}
        <p className="text-xs text-text-muted">
          L&apos;aperçu suit le titre, la description, la date et le lieu en direct. Il utilise les dates et les photos
          déjà enregistrées. Rien n&apos;est sauvegardé tant que tu ne cliques pas sur Enregistrer.
        </p>
      </div>
    </Card>
  );
}
