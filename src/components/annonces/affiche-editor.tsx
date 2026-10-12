"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import {
  AFFICHE_COULEURS,
  AFFICHE_COULEURS_TITRE,
  AFFICHE_POLICES,
  AFFICHE_POLICES_CORPS,
  AFFICHE_TAILLES,
  afficheContraste,
  normalizeAfficheCouleur,
  normalizeAffichePolice,
  normalizeAffichePoliceCorps,
  normalizeAfficheTaille,
  type AfficheFormat,
  type AffichePolice,
  type AffichePoliceCorps,
  type AfficheTaille,
} from "@/lib/annonces/affiche";
import { AFFICHE_FONT_CLASS, AFFICHE_FONT_CORPS_CLASS } from "./affiche-fonts";

export type AfficheStyleInitial = {
  couleur: string | null;
  police: string | null;
  couleurTitre: string | null;
  policeCorps: string | null;
  couleurCorps: string | null;
  tailleCorps: string | null;
};

// Style de l'affiche (fond, titre, texte), envoyé avec le formulaire
// (champs cachés), et aperçu de l'affiche recalculé à chaque modification
// du formulaire. L'aperçu n'enregistre rien.
export function AfficheEditor({
  annonceId,
  formRef,
  initial,
}: {
  annonceId?: string;
  formRef: RefObject<HTMLFormElement | null>;
  initial: AfficheStyleInitial;
}) {
  const [couleur, setCouleur] = useState<string | null>(normalizeAfficheCouleur(initial.couleur));
  const [police, setPolice] = useState<AffichePolice>(normalizeAffichePolice(initial.police) ?? "space-grotesk");
  const [couleurTitre, setCouleurTitre] = useState<string | null>(normalizeAfficheCouleur(initial.couleurTitre));
  const [policeCorps, setPoliceCorps] = useState<AffichePoliceCorps>(
    normalizeAffichePoliceCorps(initial.policeCorps) ?? "space-grotesk"
  );
  const [couleurCorps, setCouleurCorps] = useState<string | null>(normalizeAfficheCouleur(initial.couleurCorps));
  const [tailleCorps, setTailleCorps] = useState<AfficheTaille>(normalizeAfficheTaille(initial.tailleCorps) ?? "normal");
  const [format, setFormat] = useState<AfficheFormat>("carre");
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
            couleur_titre: couleurTitre,
            police_corps: policeCorps,
            couleur_corps: couleurCorps,
            taille_corps: tailleCorps,
            format,
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
  }, [formRef, annonceId, couleur, police, couleurTitre, policeCorps, couleurCorps, tailleCorps, format, version]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  // Une couleur choisie à la main peut se fondre dans le fond : on prévient
  // et on propose de revenir en automatique (toujours lisible).
  const titrePeuLisible = couleurTitre !== null && afficheContraste(couleurTitre, couleur) < 3;
  const textePeuLisible = couleurCorps !== null && afficheContraste(couleurCorps, couleur) < 4.5;
  const personnalise =
    couleur !== null ||
    couleurTitre !== null ||
    couleurCorps !== null ||
    police !== "space-grotesk" ||
    policeCorps !== "space-grotesk" ||
    tailleCorps !== "normal";

  return (
    <Card className="flex flex-col gap-5">
      <input type="hidden" name="affiche_couleur" value={couleur ?? ""} />
      <input type="hidden" name="affiche_police" value={police} />
      <input type="hidden" name="affiche_couleur_titre" value={couleurTitre ?? ""} />
      <input type="hidden" name="affiche_police_corps" value={policeCorps} />
      <input type="hidden" name="affiche_couleur_corps" value={couleurCorps ?? ""} />
      <input type="hidden" name="affiche_taille_corps" value={tailleCorps} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Affiche</h2>
        {personnalise && (
          <button
            type="button"
            onClick={() => {
              setCouleur(null);
              setPolice("space-grotesk");
              setCouleurTitre(null);
              setPoliceCorps("space-grotesk");
              setCouleurCorps(null);
              setTailleCorps("normal");
            }}
            className="text-xs text-text-muted hover:text-text hover:underline"
          >
            Revenir au style d&apos;origine
          </button>
        )}
      </div>

      <Groupe titre="Fond">
        <ChoixCouleur
          couleurs={AFFICHE_COULEURS}
          valeur={couleur}
          onChange={setCouleur}
          libelleDefaut="Origine"
          titreDefaut="Style d'origine : corail sans photo, voile noir"
        />
        <p className="text-xs text-text-muted">
          Teinte le bas de l&apos;affiche (et tout le fond s&apos;il n&apos;y a pas de photo).
        </p>
      </Groupe>

      <Groupe titre="Titre">
        <SousTitre>Police</SousTitre>
        <ChoixPolice options={AFFICHE_POLICES} valeur={police} onChange={setPolice} classes={AFFICHE_FONT_CLASS} />
        <SousTitre>Couleur</SousTitre>
        <ChoixCouleur
          couleurs={AFFICHE_COULEURS_TITRE}
          valeur={couleurTitre}
          onChange={setCouleurTitre}
          libelleDefaut="Auto"
          titreDefaut="Blanc ou noir selon la couleur du fond"
        />
        {titrePeuLisible && <AlertePeuLisible onCorriger={() => setCouleurTitre(null)} />}
      </Groupe>

      <Groupe titre="Texte (infos et description)">
        <SousTitre>Police</SousTitre>
        <ChoixPolice
          options={AFFICHE_POLICES_CORPS}
          valeur={policeCorps}
          onChange={setPoliceCorps}
          classes={AFFICHE_FONT_CORPS_CLASS}
        />
        <SousTitre>Couleur</SousTitre>
        <ChoixCouleur
          couleurs={AFFICHE_COULEURS_TITRE}
          valeur={couleurCorps}
          onChange={setCouleurCorps}
          libelleDefaut="Auto"
          titreDefaut="Blanc ou noir selon la couleur du fond"
        />
        {textePeuLisible && <AlertePeuLisible onCorriger={() => setCouleurCorps(null)} />}
        <div className="flex flex-wrap items-center gap-2">
          <SousTitre>Taille</SousTitre>
          {AFFICHE_TAILLES.map((t) => (
            <Pastille key={t.key} actif={tailleCorps === t.key} onClick={() => setTailleCorps(t.key)}>
              {t.label}
            </Pastille>
          ))}
        </div>
      </Groupe>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Aperçu</span>
          {annonceId && (
            <div className="flex items-center gap-2">
              {chargement && <span className="text-xs text-text-muted">Mise à jour…</span>}
              <Pastille actif={format === "carre"} onClick={() => setFormat("carre")}>
                Post carré
              </Pastille>
              <Pastille actif={format === "story"} onClick={() => setFormat("story")}>
                Story
              </Pastille>
            </div>
          )}
        </div>
        {annonceId ? (
          <div className="overflow-hidden rounded-xl border border-border bg-ink-raised-2">
            {apercu ? (
              // eslint-disable-next-line @next/next/no-img-element -- image générée à la volée (blob), pas optimisable
              <img
                src={apercu}
                alt="Aperçu de l'affiche"
                className={cn(
                  "mx-auto block w-full transition-opacity",
                  format === "story" && "max-w-[240px]",
                  chargement && "opacity-60"
                )}
              />
            ) : (
              <p className="px-4 py-10 text-center text-xs text-text-muted">Chargement de l&apos;aperçu…</p>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-text-muted">
            L&apos;aperçu apparaît une fois l&apos;annonce créée. Le style choisi ici sera appliqué.
          </p>
        )}
        {erreur && <p className="text-xs text-danger">{erreur}</p>}
        <p className="text-xs text-text-muted">
          L&apos;aperçu suit le titre, la description, la date et le lieu en direct. Rien n&apos;est sauvegardé tant que
          tu ne cliques pas sur Enregistrer. Pour publier, utilise ensuite « Partager l&apos;affiche » sur la page de
          l&apos;annonce.
        </p>
      </div>
    </Card>
  );
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <span className="text-sm font-semibold">{titre}</span>
      {children}
    </div>
  );
}

function SousTitre({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-text-muted">{children}</span>;
}

function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "h-7 rounded-full border px-3 text-xs font-medium",
        actif ? "border-coral bg-coral/10 text-coral" : "border-border text-text-muted hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

function AlertePeuLisible({ onCorriger }: { onCorriger: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-yellow/40 bg-yellow/10 px-3 py-2 text-xs text-text">
      Cette couleur risque d&apos;être difficile à lire sur ce fond.
      <button type="button" onClick={onCorriger} className="font-medium text-coral hover:underline">
        Remettre en Auto
      </button>
    </div>
  );
}

function ChoixPolice<K extends string>({
  options,
  valeur,
  onChange,
  classes,
}: {
  options: { key: K; label: string; description: string }[];
  valeur: K;
  onChange: (key: K) => void;
  classes: Record<K, string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          aria-pressed={valeur === p.key}
          className={cn(
            "flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors",
            valeur === p.key ? "border-coral bg-coral/10" : "border-border hover:border-coral/60"
          )}
        >
          <span className={cn("text-lg leading-tight", classes[p.key])}>{p.label}</span>
          <span className="text-xs text-text-muted">{p.description}</span>
        </button>
      ))}
    </div>
  );
}

// Pastilles de couleur + couleur libre ; null = choix par défaut.
function ChoixCouleur({
  couleurs,
  valeur,
  onChange,
  libelleDefaut,
  titreDefaut,
}: {
  couleurs: { hex: string; label: string }[];
  valeur: string | null;
  onChange: (couleur: string | null) => void;
  libelleDefaut: string;
  titreDefaut: string;
}) {
  const couleurPerso = valeur && !couleurs.some((c) => c.hex === valeur) ? valeur : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={valeur === null}
        title={titreDefaut}
        className={cn(
          "h-8 rounded-full border px-3 text-xs font-medium",
          valeur === null ? "border-coral text-coral ring-2 ring-coral/40" : "border-border text-text-muted hover:text-text"
        )}
      >
        {libelleDefaut}
      </button>
      {couleurs.map((c) => (
        <button
          key={c.hex}
          type="button"
          onClick={() => onChange(c.hex)}
          aria-pressed={valeur === c.hex}
          aria-label={c.label}
          title={c.label}
          className={cn(
            "h-8 w-8 rounded-full border border-border",
            valeur === c.hex && "ring-2 ring-coral ring-offset-2 ring-offset-ink-raised"
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
          onChange={(e) => onChange(normalizeAfficheCouleur(e.target.value))}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
