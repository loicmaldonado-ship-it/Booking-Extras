"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { accepterProposition, refuserProposition } from "@/lib/casting/agents-actions";

export type PropositionRecue = {
  id: string;
  agentNom: string;
  agentAgence: string | null;
  roleNom: string;
  prenom: string;
  nom: string;
  age: string | null;
  taille: string | null;
  lienPage: string | null;
  lienBandeDemo: string | null;
  note: string | null;
  photoUrls: string[];
  creeLe: string;
};

// Boîte de réception : chaque proposition attend ta décision avant d'entrer dans le rôle.
export function BoiteReceptionAgents({ propositions }: { propositions: PropositionRecue[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function traiter(p: PropositionRecue, accepter: boolean) {
    setErreur(null);
    setMessage(null);
    startTransition(async () => {
      const res = accepter ? await accepterProposition(p.id) : await refuserProposition(p.id);
      if (res.error) setErreur(res.error);
      else if (accepter) setMessage(`${p.prenom} ${p.nom} est dans « ${p.roleNom} ».`);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">
        Propositions à traiter <span className="text-text-muted">({propositions.length})</span>
      </h2>
      {erreur && <p className="text-sm text-danger">{erreur}</p>}
      {message && <p className="text-sm font-medium text-turquoise">{message}</p>}
      {propositions.length === 0 ? (
        <p className="text-sm text-text-muted">Rien en attente. Les propositions des agents arrivent ici, avant d&apos;entrer dans un rôle.</p>
      ) : (
        propositions.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold">
                {p.prenom} {p.nom.toUpperCase()}
              </h3>
              <span className="text-sm">pour « {p.roleNom} »</span>
              <span className="text-xs text-text-muted">
                proposé par {p.agentNom}
                {p.agentAgence ? ` (${p.agentAgence})` : ""} · {new Date(p.creeLe).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {p.photoUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {p.photoUrls.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element -- URL signée du stockage
                  <img key={u} src={u} alt="" className="h-40 w-32 rounded-lg object-cover" />
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">Aucune photo envoyée.</p>
            )}
            <p className="text-sm text-text-muted">
              {[p.age ? `Âge : ${p.age}` : null, p.taille ? `Taille : ${p.taille}` : null].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap gap-2 text-sm">
              {p.lienPage && (
                <a href={p.lienPage} target="_blank" rel="noreferrer noopener" className="font-medium text-coral hover:underline">
                  🔗 Sa page de comédien·ne
                </a>
              )}
              {p.lienBandeDemo && (
                <a href={p.lienBandeDemo} target="_blank" rel="noreferrer noopener" className="font-medium text-coral hover:underline">
                  🎬 Sa bande démo
                </a>
              )}
            </div>
            {p.note && <p className="whitespace-pre-wrap rounded-lg bg-ink px-3 py-2 text-sm">{p.note}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => traiter(p, true)}>
                Ajouter au rôle
              </Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={() => traiter(p, false)}>
                Refuser
              </Button>
            </div>
          </Card>
        ))
      )}
    </section>
  );
}
