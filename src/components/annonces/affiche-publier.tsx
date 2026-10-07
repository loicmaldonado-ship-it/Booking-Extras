"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { AfficheFormat } from "@/lib/annonces/affiche";

const FORMATS: { key: AfficheFormat; label: string; aide: string }[] = [
  { key: "carre", label: "Post carré", aide: "Fil Instagram / Facebook" },
  { key: "story", label: "Story", aide: "Story Instagram / Facebook, 1080×1920" },
];

// Capacités du navigateur, lues seulement côté client (false au rendu
// serveur) : partage de fichiers (surtout sur téléphone), copie d'image.
const pasAbonnement = () => () => {};
function peutPartagerFichiers() {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  return navigator.canShare({ files: [new File([""], "affiche.png", { type: "image/png" })] });
}
function peutCopierImage() {
  return typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";
}

const bouton =
  "rounded-full border border-border px-4 py-2 text-sm font-medium text-text-muted hover:border-coral/60 hover:text-text disabled:opacity-50";

// Publier l'affiche : sur téléphone, « Partager » ouvre la feuille de
// partage du système (Instagram, WhatsApp, Messages…) avec l'image prête ;
// sur ordinateur, télécharger ou copier l'image pour la coller ailleurs.
export function AffichePublier({ annonceId, titre, texte }: { annonceId: string; titre: string; texte: string }) {
  const [format, setFormat] = useState<AfficheFormat>("carre");
  const peutPartager = useSyncExternalStore(pasAbonnement, peutPartagerFichiers, () => false);
  const peutCopier = useSyncExternalStore(pasAbonnement, peutCopierImage, () => false);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Image déjà générée par format : le partage doit partir directement du
  // clic (sinon Safari le refuse), donc on la garde pour un second essai.
  const fichiers = useRef(new Map<AfficheFormat, File>());

  const url = `/annonces/${annonceId}/poster${format === "story" ? "?format=story" : ""}`;
  const nomFichier = `affiche-${format === "story" ? "story-" : ""}${annonceId}.png`;

  async function obtenirFichier() {
    const deja = fichiers.current.get(format);
    if (deja) return deja;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const fichier = new File([await res.blob()], nomFichier, { type: "image/png" });
    fichiers.current.set(format, fichier);
    return fichier;
  }

  async function partager() {
    setMessage(null);
    setOccupe(true);
    try {
      const fichier = await obtenirFichier();
      await navigator.share({ files: [fichier], title: titre, text: texte });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        setMessage("Affiche prête : touche à nouveau « Partager ».");
      } else {
        setMessage("Le partage n'a pas marché. Télécharge l'affiche à la place.");
      }
    } finally {
      setOccupe(false);
    }
  }

  async function copier() {
    setMessage(null);
    try {
      // Promesse passée directement au presse-papiers : Safari exige que
      // l'écriture démarre pendant le clic.
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": obtenirFichier().then((f) => f as Blob) }),
      ]);
      setMessage("Image copiée : colle-la dans ton post ou ton message.");
    } catch {
      setMessage("Impossible de copier l'image ici. Télécharge-la à la place.");
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Affiche Instagram / Facebook</h3>
        <Link href={`/annonces/${annonceId}/modifier`} className="text-xs text-coral hover:underline">
          Changer les couleurs et les polices →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            title={f.aide}
            aria-pressed={format === f.key}
            onClick={() => {
              setFormat(f.key);
              setMessage(null);
            }}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium",
              format === f.key ? "border-coral bg-coral/10 text-coral" : "border-border text-text-muted hover:text-text"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {peutPartager && (
          <button type="button" onClick={partager} disabled={occupe} className={cn(bouton, "border-coral text-coral")}>
            {occupe ? "Préparation…" : "Partager l'affiche"}
          </button>
        )}
        <a href={url} download={nomFichier} className={bouton}>
          Télécharger
        </a>
        {peutCopier && (
          <button type="button" onClick={copier} className={bouton}>
            Copier l&apos;image
          </button>
        )}
      </div>
      {message && <p className="text-xs text-text-muted">{message}</p>}
    </div>
  );
}
