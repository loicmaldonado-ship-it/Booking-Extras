"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLienRapideActif } from "@/lib/casting/actions";
import { InviterCasting, copierTexte } from "@/components/casting/inviter-casting";
import { modeleInvitationCasting } from "@/lib/casting/invitations-actions";
import type { InvitationsRole } from "@/lib/casting/data";

// Lien rapide d'un rôle : à envoyer à plusieurs personnes (SMS, réseaux…).
// Chacune se connecte ou crée son compte puis envoie ses photos / vidéos ;
// elle apparaît alors dans ce rôle.
export function LienRapideCasting({
  roleId,
  roleNom,
  lien,
  actif,
  invitations,
}: {
  roleId: string;
  roleNom: string;
  lien: string;
  actif: boolean;
  invitations: InvitationsRole | null;
}) {
  const router = useRouter();
  const [copie, setCopie] = useState(false);
  const [texteCopie, setTexteCopie] = useState(false);

  // Message d'invitation tout prêt (lien compris) pour un SMS / WhatsApp.
  async function copierTexto() {
    const texte = modeleInvitationCasting(roleId).then((m) => (m.corps ?? lien).replaceAll("{lien}", lien));
    if (await copierTexte(texte)) {
      setTexteCopie(true);
      setTimeout(() => setTexteCopie(false), 2000);
    }
  }
  const [pending, demarrer] = useTransition();

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt("Copie ce lien :", lien);
    }
  }

  function basculer() {
    demarrer(async () => {
      await setLienRapideActif(roleId, !actif);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-ink px-3 py-2 text-sm">
      <span className="font-medium">🔗 Lien rapide du casting</span>
      {actif ? (
        <>
          <code className="min-w-0 basis-full truncate rounded-lg bg-ink-raised px-2 py-1 text-xs text-text-muted sm:basis-auto sm:flex-1">
            {lien}
          </code>
          <button
            type="button"
            onClick={copier}
            className="rounded-full bg-coral px-3 py-1 text-xs font-semibold text-ink hover:bg-coral-hover"
          >
            {copie ? "Copié !" : "Copier"}
          </button>
        </>
      ) : (
        <span className="flex-1 text-xs text-text-muted">Coupé : le lien n&apos;accepte plus personne.</span>
      )}
      {actif && (
        <button
          type="button"
          onClick={copierTexto}
          title="Copie le message d'invitation avec le lien, à coller dans un SMS / WhatsApp"
          className="rounded-full border border-coral px-3 py-1 text-xs font-semibold text-coral hover:bg-coral/10"
        >
          {texteCopie ? "Copié !" : "📱 Copier le texto"}
        </button>
      )}
      {actif && <InviterCasting roleId={roleId} roleNom={roleNom} lien={lien} />}
      <button
        type="button"
        onClick={basculer}
        disabled={pending}
        className="text-xs text-text-muted hover:text-text disabled:opacity-50"
      >
        {actif ? "Couper le lien" : "Réactiver le lien"}
      </button>
      <p className="w-full text-xs text-text-muted">
        Copie-le ou <strong>invite par email</strong> des personnes pas encore dans la base : chacune crée son compte
        (ou se connecte) puis envoie les photos et vidéos calibrées pour ce rôle — elle apparaît ici automatiquement.
      </p>
      {invitations && invitations.invites > 0 && (
        <p className="w-full text-xs">
          ✉️ {invitations.invites} invité·e{invitations.invites > 1 ? "s" : ""} par email · {invitations.inscrits} ont
          rejoint le rôle · {invitations.envoyes} ont tout envoyé
        </p>
      )}
    </div>
  );
}
