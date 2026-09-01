"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ContactIcons } from "@/components/ui/contact-icons";
import { AgentNomInput } from "@/components/agents/agent-nom-input";
import { updateFigurantAgent } from "@/lib/figurants/actions";

const AGENT_NOM_CLASS =
  "w-full rounded-xl border border-border bg-ink px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 outline-none transition-colors focus:border-coral";

// Rattaché à la fiche (pas à une entrée de casting précise) — visible et
// modifiable ici comme dans la carte casting, qui partage la même donnée.
export function FigurantAgentPanel({
  figurantId,
  agentNom,
  agentEmail,
  agentTelephone,
  agentAgence,
}: {
  figurantId: string;
  agentNom: string | null;
  agentEmail: string | null;
  agentTelephone: string | null;
  agentAgence: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nom, setNom] = useState(agentNom ?? "");
  const [email, setEmail] = useState(agentEmail ?? "");
  const [telephone, setTelephone] = useState(agentTelephone ?? "");
  const [agence, setAgence] = useState(agentAgence ?? "");
  const [error, setError] = useState<string | null>(null);

  const hasAgent = !!(agentNom || agentEmail || agentTelephone || agentAgence);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("agent_nom", nom);
    fd.set("agent_email", email);
    fd.set("agent_telephone", telephone);
    fd.set("agent_agence", agence);
    startTransition(async () => {
      const result = await updateFigurantAgent(figurantId, fd);
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom de l'agent">
            <AgentNomInput
              value={nom}
              onChange={setNom}
              onSelect={(a) => {
                setNom(a.nom);
                setAgence(a.agence ?? "");
                setEmail(a.email ?? "");
                setTelephone(a.telephone ?? "");
              }}
              className={AGENT_NOM_CLASS}
            />
          </Field>
          <Field label="Agence">
            <Input value={agence} onChange={(e) => setAgence(e.target.value)} />
          </Field>
          <Field label="Email de l'agent">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Téléphone de l'agent">
            <Input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
            Annuler
          </Button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    );
  }

  if (!hasAgent) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-fit rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-text-muted hover:border-coral/60 hover:text-text"
      >
        + Ajouter un agent
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          <span className="text-text-muted">Agent : </span>
          {agentNom || "—"}
          {agentAgence ? ` (${agentAgence})` : ""}
        </span>
        <ContactIcons telephone={agentTelephone} email={agentEmail} variant="inline" />
      </div>
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-coral hover:underline">
        Modifier
      </button>
    </div>
  );
}
