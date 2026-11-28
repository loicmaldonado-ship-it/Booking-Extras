"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { afficherRepliquesATous, creerAgent, majAgent, supprimerAgent } from "@/lib/casting/agents-actions";
import { AgentNomInput } from "@/components/agents/agent-nom-input";
import { cn } from "@/lib/cn";

type AgentLigne = {
  id: string;
  nom: string;
  agence: string | null;
  email: string | null;
  token: string;
  actif: boolean;
  afficherRepliques: boolean;
  // Rattaché à l'agent de la base commune.
  dansLaBase: boolean;
  nbPropositions: number;
  nbEnAttente: number;
};

const bouton = "rounded-full border-2 border-border-strong px-3 py-1 text-xs font-semibold hover:border-coral disabled:opacity-40";

// Les agents du projet : un lien chacun, à copier et à envoyer.
export function GestionAgents({ projetId, origin, agents }: { projetId: string; origin: string; agents: AgentLigne[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nom, setNom] = useState("");
  const [agence, setAgence] = useState("");
  const [email, setEmail] = useState("");
  const [repliques, setRepliques] = useState(false);
  // Agent choisi dans les suggestions de la base commune (sinon un nouvel agent y sera ajouté).
  const [agentId, setAgentId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const lien = (a: AgentLigne) => `${origin}/agent/${a.token}`;

  function creer() {
    setErreur(null);
    startTransition(async () => {
      const res = await creerAgent(projetId, { nom, agence, email, afficherRepliques: repliques, agentId: agentId ?? undefined });
      if (res.error) return setErreur(res.error);
      setNom("");
      setAgence("");
      setEmail("");
      setRepliques(false);
      setAgentId(null);
      router.refresh();
    });
  }

  function maj(a: AgentLigne, patch: { actif?: boolean; afficherRepliques?: boolean }) {
    setErreur(null);
    startTransition(async () => {
      const res = await majAgent(a.id, patch);
      if (res.error) setErreur(res.error);
      router.refresh();
    });
  }

  // Répliques d'essai pour tous les agents d'un coup (ce que voient des personnes extérieures : on confirme).
  function repliquesPourTous(afficher: boolean) {
    const n = agents.length;
    if (
      !window.confirm(
        afficher
          ? `Montrer les répliques d'essai à ${n} agent${n > 1 ? "s" : ""} ? Ils les verront dès maintenant sur leur lien.`
          : `Cacher les répliques d'essai à ${n} agent${n > 1 ? "s" : ""} ?`
      )
    )
      return;
    setErreur(null);
    startTransition(async () => {
      const res = await afficherRepliquesATous(projetId, afficher);
      if (res.error) setErreur(res.error);
      router.refresh();
    });
  }

  function supprimer(a: AgentLigne) {
    if (!window.confirm(`Supprimer l'agent « ${a.nom} » ? Son lien ne marchera plus et ses propositions en attente seront effacées. Les profils déjà acceptés restent.`)) return;
    startTransition(async () => {
      const res = await supprimerAgent(a.id);
      if (res.error) setErreur(res.error);
      router.refresh();
    });
  }

  async function copier(a: AgentLigne) {
    try {
      await navigator.clipboard.writeText(lien(a));
      setCopie(a.id);
      setTimeout(() => setCopie((c) => (c === a.id ? null : c)), 2000);
    } catch {
      window.prompt("Copie le lien :", lien(a));
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Liens des agents</h2>
      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold">Nouvel agent</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <AgentNomInput
            value={nom}
            onChange={(v) => {
              setNom(v);
              setAgentId(null);
            }}
            onSelect={(a) => {
              setNom(a.nom);
              setAgence(a.agence ?? "");
              setEmail(a.email ?? "");
              setAgentId(a.id);
            }}
            placeholder="Nom de l'agent (cherche dans ta base)"
            className="w-full rounded-xl border border-border bg-ink px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 outline-none transition-colors focus:border-coral"
          />
          <Input value={agence} onChange={(e) => setAgence(e.target.value)} placeholder="Agence (facultatif)" aria-label="Agence" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (facultatif)" aria-label="Email de l'agent" />
        </div>
        <p className="-mt-1 text-xs text-text-muted">
          {agentId
            ? "✓ Agent de ta base : son agence et son email sont repris."
            : "Tape le nom pour retrouver un agent déjà dans ta base ; un agent nouveau y sera ajouté en créant son lien."}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={repliques} onChange={(e) => setRepliques(e.target.checked)} className="accent-coral" />
          Cet agent voit aussi les répliques d&apos;essai de chaque rôle
        </label>
        <div>
          <Button type="button" onClick={creer} disabled={pending || !nom.trim()}>
            Créer son lien
          </Button>
        </div>
      </Card>

      {agents.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm">
            <strong>{agents.filter((a) => a.afficherRepliques).length}</strong> agent{agents.filter((a) => a.afficherRepliques).length > 1 ? "s" : ""} sur {agents.length}{" "}
            {agents.filter((a) => a.afficherRepliques).length > 1 ? "voient" : "voit"} les répliques d&apos;essai.
          </span>
          <span className="flex-1" />
          <button type="button" className={bouton} disabled={pending} onClick={() => repliquesPourTous(true)}>
            Répliques visibles pour tous
          </button>
          <button type="button" className={bouton} disabled={pending} onClick={() => repliquesPourTous(false)}>
            Répliques cachées pour tous
          </button>
        </Card>
      )}

      {agents.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun agent pour l&apos;instant. Crée le premier ci-dessus : tu obtiens un lien à lui envoyer.</p>
      ) : (
        agents.map((a) => (
          <Card key={a.id} className={cn("flex flex-col gap-2 p-4", !a.actif && "opacity-60")}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold">{a.nom}</h3>
              {a.agence && <span className="text-sm text-text-muted">{a.agence}</span>}
              {a.email && <span className="text-xs text-text-muted">{a.email}</span>}
              <span className="flex-1" />
              <span className="text-xs text-text-muted">
                {a.nbPropositions} proposition{a.nbPropositions > 1 ? "s" : ""}
                {a.nbEnAttente > 0 && <strong className="ml-1 text-yellow">· {a.nbEnAttente} à traiter</strong>}
              </span>
              {a.dansLaBase && <span className="rounded-full bg-turquoise/15 px-2.5 py-0.5 text-xs font-medium text-turquoise">Dans la base</span>}
              {!a.actif && <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-medium text-danger">Lien coupé</span>}
            </div>
            <input
              readOnly
              value={lien(a)}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`Lien de ${a.nom}`}
              className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={bouton} onClick={() => copier(a)}>
                {copie === a.id ? "✓ Lien copié" : "Copier le lien"}
              </button>
              <button type="button" className={bouton} disabled={pending} onClick={() => maj(a, { afficherRepliques: !a.afficherRepliques })}>
                {a.afficherRepliques ? "Répliques d'essai : visibles" : "Répliques d'essai : cachées"}
              </button>
              <button type="button" className={bouton} disabled={pending} onClick={() => maj(a, { actif: !a.actif })}>
                {a.actif ? "Couper le lien" : "Réactiver le lien"}
              </button>
              <button type="button" className={cn(bouton, "hover:border-danger hover:text-danger")} disabled={pending} onClick={() => supprimer(a)}>
                Supprimer
              </button>
            </div>
          </Card>
        ))
      )}
    </section>
  );
}
