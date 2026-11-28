"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { basculerMediaReel, basculerPhotoDocuments } from "@/lib/casting/actions";
import { cn } from "@/lib/cn";

export type ApercuMedia = {
  // « p:<id photo> » ou « v:<chemin vidéo> » (voir lib/casting/reel-affichage).
  cle: string;
  type: "photo" | "video";
  url: string;
  label: string;
  masque: boolean;
  // Photos seulement : id, exclue des documents, et « c'est celle des documents ».
  photoId?: string;
  docsExclue?: boolean;
  pourDocs?: boolean;
};

export type ApercuProfil = {
  id: string;
  nom: string;
  valide: boolean;
  infos: string[];
  reponses: string[];
  portrait: string | null;
  medias: ApercuMedia[];
};

export type ApercuBloc = { id: string; nom: string; categorie: string; profils: ApercuProfil[] };

// Ce que le·la réal voit, rôle par rôle, avec un bouton pour retirer ou remettre
// chaque photo et chaque vidéo. Un média retiré reste affiché ici, grisé, pour
// pouvoir le remettre ; il n'est plus sur le lien.
export function ApercuReel({ blocs }: { blocs: ApercuBloc[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  // Choix faits à l'écran, affichés tout de suite avant le retour du serveur.
  const [choix, setChoix] = useState<Record<string, boolean>>({});

  const [choixDocs, setChoixDocs] = useState<Record<string, boolean>>({});
  const exclueDocs = (profilId: string, m: ApercuMedia) =>
    `${profilId}|${m.photoId}` in choixDocs ? choixDocs[`${profilId}|${m.photoId}`] : !!m.docsExclue;

  function basculerDocs(profilId: string, m: ApercuMedia) {
    if (!m.photoId) return;
    const exclue = !exclueDocs(profilId, m);
    const k = `${profilId}|${m.photoId}`;
    setErreur(null);
    setChoixDocs((prev) => ({ ...prev, [k]: exclue }));
    startTransition(async () => {
      const res = await basculerPhotoDocuments(profilId, m.photoId!, exclue);
      if (res.error) {
        setErreur(res.error);
        setChoixDocs((prev) => ({ ...prev, [k]: !exclue }));
      }
      router.refresh();
    });
  }

  const masqueDe = (profilId: string, m: ApercuMedia) => (`${profilId}|${m.cle}` in choix ? choix[`${profilId}|${m.cle}`] : m.masque);

  function basculer(profilId: string, m: ApercuMedia) {
    const masque = !masqueDe(profilId, m);
    setErreur(null);
    setChoix((prev) => ({ ...prev, [`${profilId}|${m.cle}`]: masque }));
    startTransition(async () => {
      const res = await basculerMediaReel(profilId, m.cle, masque);
      if (res.error) {
        setErreur(res.error);
        setChoix((prev) => ({ ...prev, [`${profilId}|${m.cle}`]: !masque }));
      }
      router.refresh();
    });
  }

  const profils = blocs.flatMap((b) => b.profils);
  const nbMedias = profils.reduce((n, p) => n + p.medias.length, 0);
  const nbCaches = profils.reduce((n, p) => n + p.medias.filter((m) => masqueDe(p.id, m)).length, 0);
  const sansProfil = blocs.filter((b) => b.profils.length === 0);

  if (blocs.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-muted">
          Rien n&apos;est visible sur ce lien pour l&apos;instant : aucun rôle n&apos;est marqué visible. Rends des rôles et
          des profils visibles depuis la page Casting (« 👁️ Visible » sur chaque carte).
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm">
        <strong>{blocs.length}</strong> rôle{blocs.length > 1 ? "s" : ""} visible{blocs.length > 1 ? "s" : ""},{" "}
        <strong>{profils.length}</strong> profil{profils.length > 1 ? "s" : ""}, {nbMedias} photo{nbMedias > 1 ? "s" : ""} et
        vidéo{nbMedias > 1 ? "s" : ""} dont{" "}
        <strong className={nbCaches > 0 ? "text-danger" : ""}>{nbCaches} retiré{nbCaches > 1 ? "s" : ""} du lien</strong>.
      </p>
      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      {blocs
        .filter((b) => b.profils.length > 0)
        .map((b) => (
          <section key={b.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-ink-raised p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold">{b.nom}</h2>
              <span className="text-xs text-text-muted">
                {b.categorie} · {b.profils.length} profil{b.profils.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {b.profils.map((p) => (
                <article key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-ink p-3">
                  <div className="flex items-start gap-3">
                    {p.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
                      <img src={p.portrait} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-ink-raised-2 text-xs text-text-muted">
                        Pas de photo
                      </div>
                    )}
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.nom}</span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            p.valide ? "bg-turquoise/15 text-turquoise" : "bg-yellow/15 text-yellow"
                          )}
                        >
                          {p.valide ? "Validé·e" : "À valider"}
                        </span>
                      </div>
                      {p.infos.length > 0 && <p className="text-xs text-text-muted">{p.infos.join(" · ")}</p>}
                      {p.reponses.length > 0 && <p className="text-xs text-text-muted">{p.reponses.join(" · ")}</p>}
                    </div>
                  </div>

                  {p.medias.length === 0 ? (
                    <p className="text-xs text-text-muted">Aucune photo ni vidéo sur ce profil.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {p.medias.map((m) => {
                        const masque = masqueDe(p.id, m);
                        const exclue = m.type === "photo" && exclueDocs(p.id, m);
                        return (
                          <div key={m.cle} className="flex flex-col gap-1.5">
                            <div className={cn("relative overflow-hidden rounded-lg border border-border bg-ink-raised-2", masque && "opacity-35")}>
                              {m.type === "video" ? (
                                <video src={m.url} preload="metadata" muted controls={!masque} className="aspect-[4/5] w-full object-cover" />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
                                <img src={m.url} alt={m.label} className="aspect-[4/5] w-full object-cover" />
                              )}
                              <span className="absolute left-1 top-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium">
                                {m.type === "video" ? "🎬" : "📷"} {m.label}
                              </span>
                              {masque && (
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                                  Caché au réal
                                </span>
                              )}
                              {m.pourDocs && !exclue && (
                                <span className="absolute bottom-1 left-1 rounded-full bg-coral px-2 py-0.5 text-[10px] font-semibold text-ink">
                                  📄 Photo des documents
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => basculer(p.id, m)}
                              className={cn(
                                "rounded-full border-2 px-2.5 py-1 text-xs font-semibold transition-colors",
                                masque
                                  ? "border-turquoise text-turquoise hover:bg-turquoise/10"
                                  : "border-border-strong text-text hover:border-danger hover:text-danger"
                              )}
                            >
                              {masque ? "↩ Remettre" : "✕ Retirer du lien"}
                            </button>
                            {m.type === "photo" && (
                              <button
                                type="button"
                                onClick={() => basculerDocs(p.id, m)}
                                className={cn(
                                  "rounded-full border-2 px-2.5 py-1 text-xs font-semibold transition-colors",
                                  exclue
                                    ? "border-turquoise text-turquoise hover:bg-turquoise/10"
                                    : "border-border-strong text-text hover:border-danger hover:text-danger"
                                )}
                              >
                                {exclue ? "↩ Remettre aux documents" : "✕ Retirer des documents"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}

      {sansProfil.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          Rôles à venir, cités en bas du lien :
          {sansProfil.map((b) => (
            <span key={b.id} className="rounded-full bg-ink-raised-2 px-3 py-1 text-xs font-medium">
              {b.nom}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
