"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { enregistrerChoixPhotos } from "@/lib/bookings/photos-actions";

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
const ROLE_EMPLACEMENT = ["Trombi + fiche", "Fiche", "Fiche"];

type Photo = { id: string; url: string; type: string };
export type ApercuPersonne = {
  figurantId: string;
  nom: string;
  fonction: string | null;
  manuel: boolean;
  selection: Photo[];
  groupes: { titre: string; photos: Photo[] }[];
};

// Chaque personne : ses photos retenues (dans l'ordre) et les autres à portée de clic.
export function ApercuPhotosDocs({
  projetId,
  personnes,
  libelleQui,
}: {
  projetId: string;
  personnes: ApercuPersonne[];
  libelleQui: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  // Sélections modifiées à l'écran, affichées tout de suite avant le retour du serveur.
  const [choix, setChoix] = useState<Record<string, string[]>>({});
  const [manuels, setManuels] = useState<Record<string, boolean>>({});

  if (personnes.length === 0) {
    return <p className="text-sm text-text-muted">Aucune personne ({libelleQui}) pour cette journée.</p>;
  }

  function enregistrer(p: ApercuPersonne, ids: string[] | null) {
    setErreur(null);
    if (ids) {
      setChoix((prev) => ({ ...prev, [p.figurantId]: ids }));
      setManuels((prev) => ({ ...prev, [p.figurantId]: true }));
    }
    startTransition(async () => {
      const res = await enregistrerChoixPhotos(projetId, p.figurantId, ids);
      if (res.error) setErreur(res.error);
      if (ids === null) {
        setChoix((prev) => {
          const { [p.figurantId]: _retire, ...reste } = prev;
          void _retire;
          return reste;
        });
        setManuels((prev) => ({ ...prev, [p.figurantId]: false }));
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erreur && <p className="text-sm text-danger">{erreur}</p>}
      {personnes.map((p) => {
        const parId = new Map([...p.selection, ...p.groupes.flatMap((g) => g.photos)].map((x) => [x.id, x]));
        const ids = (choix[p.figurantId] ?? p.selection.map((s) => s.id)).filter((id) => parId.has(id));
        const manuel = manuels[p.figurantId] ?? p.manuel;
        const autres = p.groupes
          .map((g) => ({ ...g, photos: g.photos.filter((x) => !ids.includes(x.id)) }))
          .filter((g) => g.photos.length > 0);
        return (
          <section key={p.figurantId} className="flex flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold">{p.nom}</h2>
              {p.fonction && <span className="text-xs text-text-muted">{p.fonction}</span>}
              <span className="text-xs text-text-muted">{manuel ? "Choix enregistré" : "Photos par défaut"}</span>
              <span className="flex-1" />
              {manuel && (
                <button
                  type="button"
                  onClick={() => enregistrer(p, null)}
                  className="rounded-full border-2 border-border-strong px-3 py-1 text-xs font-semibold hover:border-coral"
                >
                  Revenir au choix par défaut
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: MAX }, (_, i) => {
                const photo = ids[i] ? parId.get(ids[i]) : undefined;
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">{i + 1} · {ROLE_EMPLACEMENT[i]}</p>
                    {photo ? (
                      <>
                        <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-raised-2">
                          <Image src={photo.url} alt="" fill sizes="200px" className="object-cover" unoptimized />
                          <span className="absolute left-1 top-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium">
                            {TYPE_LABEL[photo.type] ?? photo.type}
                          </span>
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => enregistrer(p, [photo.id, ...ids.filter((x) => x !== photo.id)])}
                              className="rounded-full border-2 border-border-strong px-2 py-0.5 text-[11px] font-semibold hover:border-coral"
                            >
                              ★ Photo du trombi
                            </button>
                          )}
                          {ids.length > 1 && (
                            <button
                              type="button"
                              onClick={() => enregistrer(p, ids.filter((x) => x !== photo.id))}
                              className="rounded-full border-2 border-border-strong px-2 py-0.5 text-[11px] font-semibold hover:border-danger hover:text-danger"
                            >
                              ✕ Retirer
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border-2 border-dashed border-border text-center text-[11px] text-text-muted">
                        Libre : ajoute une photo ci-dessous
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {autres.length === 0 ? (
              <p className="text-xs text-text-muted">Aucune autre photo pour cette personne.</p>
            ) : (
              autres.map((g) => (
                <div key={g.titre} className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold">{g.titre}</h3>
                  <div className="flex flex-wrap gap-2">
                    {g.photos.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        disabled={ids.length >= MAX}
                        onClick={() => enregistrer(p, [...ids, x.id])}
                        title={ids.length >= MAX ? "3 photos au maximum : retire-en une d'abord" : "Ajouter aux documents"}
                        className={cn(
                          "flex w-20 flex-col gap-1 rounded-lg border-2 border-transparent p-0.5 text-left text-[10px] text-text-muted",
                          ids.length >= MAX ? "opacity-50" : "hover:border-coral"
                        )}
                      >
                        <span className="relative block aspect-[3/4] w-full overflow-hidden rounded-md bg-ink-raised-2">
                          <Image src={x.url} alt="" fill sizes="80px" className="object-cover" unoptimized />
                        </span>
                        ＋ {TYPE_LABEL[x.type] ?? x.type}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}
