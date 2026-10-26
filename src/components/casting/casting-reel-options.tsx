"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReelOption, type CategorieLien } from "@/lib/partage/actions";
import type { OptionsReel } from "@/lib/partage/data";
import { cn } from "@/lib/cn";

const INFOS: { cle: keyof OptionsReel; libelle: string }[] = [
  { cle: "age", libelle: "Âge" },
  { cle: "ville", libelle: "Ville" },
  { cle: "taille", libelle: "Taille" },
  { cle: "mensurations", libelle: "Autres mensurations" },
  { cle: "reponses", libelle: "Réponses aux questions du rôle" },
];

const RETOUR: { cle: keyof OptionsReel; libelle: string; aide: string }[] = [
  { cle: "avis", libelle: "Avis Oui / Peut-être / Non", aide: "Le·la réal coche son avis sur chaque profil ; tu le vois sur la carte du profil." },
  { cle: "commentairesProfil", libelle: "Commentaires par profil", aide: "Le·la réal peut écrire un mot sur un profil précis." },
];

// Réglage du lien réal : ce qui est montré (le nom, les vidéos et les photos
// le sont toujours) et ce que le·la réal peut faire. Chaque case s'applique
// tout de suite au lien.
export function CastingReelOptions({ projetId, options, categorie = null }: { projetId: string; options: OptionsReel; categorie?: CategorieLien }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changer(cle: keyof OptionsReel, valeur: boolean) {
    startTransition(async () => {
      await updateReelOption(projetId, cle, valeur, categorie);
      router.refresh();
    });
  }

  const case_ = (cle: keyof OptionsReel, libelle: string) => (
    <label key={cle} className={cn("flex items-center gap-2 text-xs font-medium", pending && "opacity-60")}>
      <input
        type="checkbox"
        checked={options[cle]}
        disabled={pending}
        onChange={(e) => changer(cle, e.target.checked)}
        className="h-4 w-4 rounded border-border accent-turquoise"
      />
      {libelle}
    </label>
  );

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-text-muted">Infos montrées au·à la réal sur ce lien (nom, vidéos et photos toujours) :</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">{INFOS.map((i) => case_(i.cle, i.libelle))}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-text-muted">Ce que le·la réal peut faire :</span>
        {RETOUR.map((r) => (
          <div key={r.cle} className="flex flex-col">
            {case_(r.cle, r.libelle)}
            <span className="ml-6 text-[11px] text-text-muted">{r.aide}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
