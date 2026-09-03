"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCastingDocVisible } from "@/lib/partage/actions";
import { cn } from "@/lib/cn";

export function CastingDocsVisibilityToggle({
  projetId,
  listeArtistique,
  fichesRoles,
  distribution,
}: {
  projetId: string;
  listeArtistique: boolean;
  fichesRoles: boolean;
  distribution: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(doc: "liste_artistique" | "fiches_roles" | "distribution", visible: boolean) {
    startTransition(async () => {
      await updateCastingDocVisible(projetId, doc, visible);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-2">
      <span className="text-xs text-text-muted">Documents visibles/téléchargeables sur ce lien :</span>
      <label className={cn("flex items-center gap-2 text-xs font-medium", pending && "opacity-60")}>
        <input
          type="checkbox"
          checked={listeArtistique}
          disabled={pending}
          onChange={(e) => toggle("liste_artistique", e.target.checked)}
          className="h-4 w-4 rounded border-border accent-turquoise"
        />
        Liste artistique
      </label>
      <label className={cn("flex items-center gap-2 text-xs font-medium", pending && "opacity-60")}>
        <input
          type="checkbox"
          checked={fichesRoles}
          disabled={pending}
          onChange={(e) => toggle("fiches_roles", e.target.checked)}
          className="h-4 w-4 rounded border-border accent-turquoise"
        />
        Fiches rôles validés
      </label>
      <label className={cn("flex items-center gap-2 text-xs font-medium", pending && "opacity-60")}>
        <input
          type="checkbox"
          checked={distribution}
          disabled={pending}
          onChange={(e) => toggle("distribution", e.target.checked)}
          className="h-4 w-4 rounded border-border accent-turquoise"
        />
        Distribution
      </label>
    </div>
  );
}
