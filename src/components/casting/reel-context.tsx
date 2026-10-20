"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { Lang } from "@/lib/i18n/partage";
import { useVisiteur, type Visiteur } from "@/components/partage/visiteur";
import { donnerAvis, lireMesAvis } from "@/lib/casting/reel";
import { signalerVisitePartage } from "@/lib/partage/suivi";
import type { Avis } from "@/lib/casting/avis";

// Ce que le lien réal permet (réglé côté équipe) et mes avis, partagés entre
// les cartes du trombinoscope et la fenêtre de visionnage.
type ReelCtx = {
  token: string;
  lang: Lang;
  avisActifs: boolean;
  commentairesActifs: boolean;
  // Aperçu ouvert par l'équipe : on voit les réglages, rien n'est enregistré.
  apercu: boolean;
  moi: Visiteur | null;
  mesAvis: Record<string, Avis>;
  donner: (entryId: string, avis: Avis | null) => Promise<string | null>;
};

const Ctx = createContext<ReelCtx | null>(null);

export function useReel(): ReelCtx | null {
  return useContext(Ctx);
}

export function ReelProvider({
  token,
  lang,
  avisActifs,
  commentairesActifs,
  children,
}: {
  token: string;
  lang: Lang;
  avisActifs: boolean;
  commentairesActifs: boolean;
  children: ReactNode;
}) {
  const apercu = useSearchParams().get("apercu") === "1";
  const vrai = useVisiteur();
  const moi = apercu ? null : vrai;
  const [mesAvis, setMesAvis] = useState<Record<string, Avis>>({});

  useEffect(() => {
    if (!avisActifs || !moi) return;
    lireMesAvis(token, moi.id).then(setMesAvis);
  }, [avisActifs, moi, token]);

  // Re-toucher le même bouton retire l'avis. Mise à jour immédiate, annulée
  // si l'enregistrement échoue ; renvoie le message d'erreur éventuel.
  const donner = useCallback(
    async (entryId: string, avis: Avis | null) => {
      if (!moi || apercu) return null;
      const avant = mesAvis[entryId] ?? null;
      const nouveau = avant === avis ? null : avis;
      setMesAvis((m) => {
        const next = { ...m };
        if (nouveau) next[entryId] = nouveau;
        else delete next[entryId];
        return next;
      });
      // Le·la visiteur·se doit être connu·e du lien avant de répondre.
      await signalerVisitePartage(token, moi.id, moi.prenom, moi.role);
      const res = await donnerAvis(token, moi.id, entryId, nouveau);
      if (res.error) {
        setMesAvis((m) => {
          const next = { ...m };
          if (avant) next[entryId] = avant;
          else delete next[entryId];
          return next;
        });
        return res.error;
      }
      return null;
    },
    [moi, apercu, mesAvis, token]
  );

  const valeur = useMemo(
    () => ({ token, lang, avisActifs, commentairesActifs, apercu, moi, mesAvis, donner }),
    [token, lang, avisActifs, commentairesActifs, apercu, moi, mesAvis, donner]
  );
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}
