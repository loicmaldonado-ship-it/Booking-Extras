"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { StatusSelect } from "@/components/ui/status-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  updateEssayageStatutInline,
  updateEssayageReponseRecue,
  removeEssayageFromJournee,
  recordEssayageMessage,
} from "@/lib/essayages/actions";
import { ESSAYAGE_STATUTS, type EssayageStatut } from "@/lib/essayages/types";
import { buildEssayagePropositionMailto, buildEssayageConfirmationMailto } from "@/lib/essayages/messages";
import type { Genre } from "@/lib/figurants/types";
import type { Creneau } from "./creneaux-panel";

const STATUT_TONE: Record<EssayageStatut, "yellow" | "coral" | "turquoise"> = {
  "proposé": "yellow",
  "confirmé": "coral",
  "fait": "turquoise",
};

export type EssayageRow = {
  id: string;
  statut: EssayageStatut;
  heure: string | null;
  notes: string | null;
  reponse_recue: boolean;
  creneau_id?: string | null;
  numero_costume?: string | null;
  figurant_id: string;
  figurants: { prenom: string; nom: string; telephone: string | null; email: string | null; genre?: Genre | null } | null;
  portraitUrl: string | null;
};

export function EssayageJourneeTable({
  rows,
  projetId,
  projetNom,
  signature,
  journeeDate,
  journeeLieu,
  creneaux = [],
}: {
  rows: EssayageRow[];
  projetId?: string;
  projetNom: string;
  signature: string | null;
  journeeDate: string;
  journeeLieu: string | null;
  creneaux?: Creneau[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [consigne, setConsigne] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  function heureFor(r: EssayageRow): string | null {
    const creneau = creneaux.find((c) => c.id === r.creneau_id);
    return creneau?.heure_debut ?? r.heure;
  }

  function setStatut(id: string, statut: EssayageStatut) {
    startTransition(async () => {
      await updateEssayageStatutInline(id, statut);
      router.refresh();
    });
  }

  function setReponseRecue(id: string, value: boolean) {
    startTransition(async () => {
      await updateEssayageReponseRecue(id, value);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeEssayageFromJournee(id);
      router.refresh();
    });
  }

  function sendProposition(r: EssayageRow) {
    if (!r.figurants?.email) return;
    const { subject, body } = buildEssayagePropositionMailto({
      figurantPrenom: r.figurants.prenom,
      figurantEmail: r.figurants.email,
      date: journeeDate,
      heure: heureFor(r),
      lieu: journeeLieu,
      projetNom,
      signature,
    });
    setSendError(null);
    startTransition(async () => {
      const result = await recordEssayageMessage(r.figurant_id, body, r.figurants!.email, subject, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
    });
  }

  function sendConfirmation(r: EssayageRow) {
    if (!r.figurants?.email) return;
    const { subject, body } = buildEssayageConfirmationMailto({
      figurantPrenom: r.figurants.prenom,
      figurantEmail: r.figurants.email,
      date: journeeDate,
      heure: heureFor(r),
      lieu: journeeLieu,
      projetNom,
      signature,
      consigne,
      numeroCostume: r.numero_costume,
    });
    setSendError(null);
    startTransition(async () => {
      const result = await recordEssayageMessage(r.figurant_id, body, r.figurants!.email, subject, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
    });
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-text-muted">Aucun profil pour cette journée d&apos;essayage.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sendError && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{sendError}</div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted">
          Consigne à ajouter aux messages de confirmation (optionnel)
        </label>
        <input
          value={consigne}
          onChange={(e) => setConsigne(e.target.value)}
          placeholder="Ex : merci de venir avec les cheveux propres"
          className="w-full max-w-md rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none focus:border-coral"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {rows.map((r) => (
          <div
            key={r.id}
            className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-ink-raised p-3 text-center"
          >
            <button
              type="button"
              onClick={() => remove(r.id)}
              disabled={pending}
              className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-text-muted hover:bg-danger hover:text-ink"
              title="Retirer de cette journée"
            >
              ×
            </button>
            <Link href={`/figurants/${r.figurant_id}`} className="flex w-full flex-col items-center gap-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
                {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
              </div>
              <div className="text-sm font-medium">
                {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                {heureFor(r) && <span>{heureFor(r)!.slice(0, 5)}</span>}
                {r.numero_costume && <span className="text-coral">· {r.numero_costume}</span>}
              </div>
            </Link>
            <StatusSelect
              tone={STATUT_TONE[r.statut]}
              value={r.statut}
              disabled={pending}
              onChange={(e) => setStatut(r.id, e.target.value as EssayageStatut)}
              className="w-full"
            >
              {ESSAYAGE_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </StatusSelect>
            <label
              className={cn(
                "flex w-fit items-center gap-1.5 text-xs font-medium",
                r.reponse_recue ? "text-yellow" : "text-text-muted"
              )}
            >
              <input
                type="checkbox"
                checked={r.reponse_recue}
                disabled={pending}
                onChange={(e) => setReponseRecue(r.id, e.target.checked)}
                className="h-4 w-4 rounded border-border accent-yellow"
              />
              Répondu
            </label>
            {r.figurants?.email ? (
              <div className="flex w-full flex-col gap-1">
                <Button type="button" variant="ghost" onClick={() => sendProposition(r)}>
                  Proposition
                </Button>
                <Button
                  type="button"
                  variant={r.reponse_recue ? "secondary" : "ghost"}
                  onClick={() => sendConfirmation(r)}
                >
                  Confirmation
                </Button>
              </div>
            ) : (
              <span className="text-xs text-text-muted">Pas d&apos;email</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
