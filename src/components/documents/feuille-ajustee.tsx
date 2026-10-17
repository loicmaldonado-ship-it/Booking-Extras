"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// À l'écran, réduit la feuille A4 pour qu'elle tienne en entier dans la
// largeur disponible (iPad, téléphone…) au lieu d'être coupée sur les côtés.
// Le PDF (classe « capture-pdf ») et l'impression gardent la vraie taille.
export function FeuilleAjustee({ largeur, children }: { largeur: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entree]) => {
      setZoom(Math.min(1, entree.contentRect.width / largeur));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [largeur]);

  return (
    <div ref={ref} className="w-full">
      <div className="feuille-ajustee" style={{ zoom }}>
        {children}
      </div>
    </div>
  );
}
