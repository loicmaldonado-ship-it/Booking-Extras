"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyLink } from "@/components/annonces/copy-link";
import { createJourneePartageLien, revokeJourneePartageLien } from "@/lib/partage/actions";

export function PartageJourneeButton({
  projetId,
  date,
  initialToken,
  initialShowContacts,
  publicBaseUrl,
}: {
  projetId: string;
  date: string;
  initialToken: string | null;
  initialShowContacts: boolean;
  publicBaseUrl: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState(initialToken);
  const [showContacts, setShowContacts] = useState(initialShowContacts);

  function create(withContacts: boolean) {
    startTransition(async () => {
      const t = await createJourneePartageLien(projetId, date, withContacts);
      setToken(t);
      setShowContacts(withContacts);
      router.refresh();
    });
  }

  function revoke() {
    startTransition(async () => {
      await revokeJourneePartageLien(projetId, date);
      setToken(null);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Partager la journée
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-ink-raised px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Partager cette journée</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text">
          Fermer
        </button>
      </div>

      {token ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-muted">
            {showContacts
              ? "Ce lien montre les coordonnées (téléphone/email) des profils."
              : "Ce lien masque les coordonnées (téléphone/email) des profils."}
          </p>
          <CopyLink url={`${publicBaseUrl}/${token}`} />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => create(!showContacts)}>
              {showContacts ? "Régénérer sans les contacts" : "Régénérer avec les contacts"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={revoke}>
              Révoquer
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-muted">Choisis si les coordonnées des profils doivent être visibles.</p>
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={() => create(true)}>
              Avec les contacts
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => create(false)}>
              Sans les contacts
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
