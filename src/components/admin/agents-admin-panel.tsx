"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ContactIcons } from "@/components/ui/contact-icons";
import { createAgent, updateAgent, deleteAgent } from "@/lib/agents/actions";
import type { Agent } from "@/lib/agents/types";

function AgentRow({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nom, setNom] = useState(agent.nom);
  const [agence, setAgence] = useState(agent.agence ?? "");
  const [email, setEmail] = useState(agent.email ?? "");
  const [telephone, setTelephone] = useState(agent.telephone ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("nom", nom);
    fd.set("agence", agence);
    fd.set("email", email);
    fd.set("telephone", telephone);
    startTransition(async () => {
      const result = await updateAgent(agent.id, fd);
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!confirm(`Supprimer l'agent « ${agent.nom} » ?`)) return;
    startTransition(async () => {
      await deleteAgent(agent.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-coral/40 bg-ink px-4 py-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" />
          <Input value={agence} onChange={(e) => setAgence(e.target.value)} placeholder="Agence" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-text-muted hover:text-text">
            Annuler
          </button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div>
        <div className="font-medium">
          {agent.nom}
          {agent.agence && <span className="text-text-muted"> · {agent.agence}</span>}
        </div>
        <ContactIcons telephone={agent.telephone} email={agent.email} variant="inline" />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-coral hover:underline">
          Modifier
        </button>
        <button type="button" disabled={pending} onClick={remove} className="text-xs text-text-muted hover:text-danger">
          Supprimer
        </button>
      </div>
    </div>
  );
}

function NewAgentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createAgent, undefined);

  useEffect(() => {
    async function closeOnSuccess() {
      if (state?.success) {
        setOpen(false);
        router.refresh();
      }
    }
    closeOnSuccess();
  }, [state, router]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Nouvel agent
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-coral/40 bg-ink px-4 py-3">
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nom" required>
          <Input name="nom" required />
        </Field>
        <Field label="Agence">
          <Input name="agence" />
        </Field>
        <Field label="Email">
          <Input type="email" name="email" />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" name="telephone" />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text">
          Annuler
        </button>
        <Button type="submit" disabled={pending}>
          {pending ? "..." : "Créer"}
        </Button>
      </div>
    </form>
  );
}

export function AgentsAdminPanel({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.nom.toLowerCase().includes(q) ||
        (a.agence ?? "").toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q)
    );
  }, [agents, query]);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Agents <span className="text-sm font-normal text-text-muted">({agents.length})</span>
        </h2>
        <NewAgentForm />
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un agent, une agence, un email..."
        className="w-full rounded-xl border border-border bg-ink px-3.5 py-2.5 text-sm outline-none focus:border-coral"
      />
      <div className="flex flex-col gap-2">
        {filtered.map((a) => (
          <AgentRow key={a.id} agent={a} />
        ))}
        {filtered.length === 0 && <p className="text-sm text-text-muted">Aucun agent trouvé.</p>}
      </div>
    </Card>
  );
}
