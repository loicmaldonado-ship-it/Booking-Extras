"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyLink } from "@/components/annonces/copy-link";
import { createPartageLien, revokePartageLien, type PartageType } from "@/lib/partage/actions";

export function PartageCard({
  projetId,
  type,
  label,
  description,
  token,
  publicBaseUrl,
}: {
  projetId: string;
  type: PartageType;
  label: string;
  description: string;
  token: string | null;
  publicBaseUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      await createPartageLien(projetId, type);
      router.refresh();
    });
  }

  function revoke() {
    startTransition(async () => {
      await revokePartageLien(projetId, type);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-ink-raised px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        <p className="text-xs text-text-muted">{description}</p>
      </div>

      {token ? (
        <div className="flex flex-col gap-2">
          <CopyLink url={`${publicBaseUrl}/${token}`} />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={create}>
              Régénérer le lien
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={revoke}>
              Révoquer
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" disabled={pending} onClick={create}>
          {pending ? "Création..." : "Créer un lien de partage"}
        </Button>
      )}
    </div>
  );
}
