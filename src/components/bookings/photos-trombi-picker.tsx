"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { chargerChoixPhotos, enregistrerChoixPhotos, type ChoixPhotos, type PhotoChoix } from "@/lib/bookings/photos-actions";

const MAX = 3;
const TYPE_LABEL: Record<string, string> = {
  portrait: "Portrait",
  pied: "En pied",
  selfie: "Selfie",
  autre: "Autre",
  vehicule: "Véhicule",
  tenue: "Essayage",
  casting: "Casting",
};

// Choix des photos des trombis et fiches mensuration d'une personne sur le
// projet (jusqu'à 3 ; la première est la photo principale du trombi).
export function PhotosTrombiPicker({
  projetId,
  figurantId,
  nom,
  compact = false,
}: {
  projetId: string;
  figurantId: string;
  nom: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [donnees, setDonnees] = useState<ChoixPhotos | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();

  function ouvrir() {
    setOuvert(true);
    setErreur(null);
    demarrer(async () => {
      const res = await chargerChoixPhotos(projetId, figurantId);
      if (res.error || !res.data) {
        setErreur(res.error ?? "Chargement impossible.");
        return;
      }
      setDonnees(res.data);
      setSelection(res.data.selection);
    });
  }

  function basculer(id: string) {
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX ? s : [...s, id]));
  }

  function enregistrer(ids: string[] | null) {
    demarrer(async () => {
      const res = await enregistrerChoixPhotos(projetId, figurantId, ids);
      if (res.error) {
        setErreur(res.error);
        return;
      }
      setOuvert(false);
      router.refresh();
    });
  }

  const groupe = (titre: string, photos: PhotoChoix[], aide?: string) =>
    photos.length > 0 && (
      <div className="flex flex-col gap-2">
        <div>
          <h4 className="text-sm font-semibold">{titre}</h4>
          {aide && <p className="text-xs text-text-muted">{aide}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p) => {
            const rangChoisi = selection.indexOf(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => basculer(p.id)}
                className={cn(
                  "relative flex flex-col gap-1 rounded-xl border-2 p-1 text-left text-xs text-text-muted",
                  rangChoisi >= 0 ? "border-coral" : "border-transparent hover:border-border"
                )}
              >
                <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-raised-2">
                  <Image src={p.url} alt="" fill sizes="140px" className="object-cover" unoptimized />
                  {rangChoisi >= 0 && (
                    <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-coral text-xs font-bold text-ink">
                      {rangChoisi + 1}
                    </span>
                  )}
                </span>
                {TYPE_LABEL[p.type] ?? p.type}
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        title="Choisir les photos des trombis et fiches mensuration"
        className={cn(
          "rounded-full border border-border font-medium text-text-muted hover:border-coral/60 hover:text-text",
          compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
        )}
      >
        📷 Photos
      </button>
      {ouvert &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photos du trombi — ${nom}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
          onClick={() => setOuvert(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-ink-raised p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Photos du trombi — {nom}</h3>
                <p className="text-sm text-text-muted">
                  Clique jusqu&apos;à {MAX} photos, dans l&apos;ordre : la <strong>1</strong> est la photo principale du
                  trombi, les 3 vont sur la fiche mensuration.
                </p>
              </div>
              <button type="button" onClick={() => setOuvert(false)} className="text-sm text-text-muted hover:text-text">
                Fermer
              </button>
            </div>

            {!donnees && !erreur && <p className="text-sm text-text-muted">Chargement…</p>}
            {erreur && <p className="text-sm text-danger">{erreur}</p>}
            {donnees && (
              <>
                <p className="text-xs text-text-muted">
                  {donnees.manuel
                    ? "Choix enregistré pour ce projet."
                    : "Pas de choix enregistré : photos par défaut (essayage du projet, sinon candidature, sinon compte)."}
                </p>
                {groupe("Essayage sur ce projet", donnees.essayage, "Prioritaires par défaut, et reprennent la main après un nouvel essayage.")}
                {groupe("Candidature", donnees.candidature)}
                {groupe("Compte", donnees.compte)}
                {donnees.essayage.length + donnees.candidature.length + donnees.compte.length === 0 && (
                  <p className="text-sm text-text-muted">Aucune photo pour cette personne.</p>
                )}
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button type="button" disabled={pending || selection.length === 0} onClick={() => enregistrer(selection)}>
                    {pending ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                  {donnees.manuel && (
                    <Button type="button" variant="secondary" disabled={pending} onClick={() => enregistrer(null)}>
                      Revenir au choix par défaut
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
