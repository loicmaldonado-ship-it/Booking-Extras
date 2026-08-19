"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { sendStaffMessageToFigurant, notifyFigurantByEmail } from "@/lib/figurants/messages-actions";
import { FIGURANT_MESSAGE_CATEGORIES, type FigurantMessage, type FigurantMessageCategorie } from "@/lib/candidats/types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function MessageriePanel({
  figurantId,
  figurantEmail,
  figurantPrenom,
  messages,
}: {
  figurantId: string;
  figurantEmail: string | null;
  figurantPrenom: string;
  messages: FigurantMessage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [corps, setCorps] = useState("");
  const [categorie, setCategorie] = useState<FigurantMessageCategorie>("libre");
  const [error, setError] = useState<string | null>(null);

  function send() {
    if (!corps.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("corps", corps.trim());
    fd.set("categorie", categorie);
    if (figurantEmail) fd.set("email", figurantEmail);
    startTransition(async () => {
      const result = await sendStaffMessageToFigurant(figurantId, fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.emailError) setError(`Message enregistré mais email non envoyé : ${result.emailError}`);
      setCorps("");
      router.refresh();
    });
  }

  function notify() {
    if (!figurantEmail) return;
    setError(null);
    startTransition(async () => {
      const result = await notifyFigurantByEmail(figurantId, figurantEmail, figurantPrenom, window.location.origin);
      if (result?.error) setError(result.error);
    });
  }

  const sections = FIGURANT_MESSAGE_CATEGORIES.map((c) => ({
    ...c,
    messages: messages.filter((m) => m.categorie === c.value),
  })).filter((s) => s.messages.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {sections.length === 0 && <p className="text-sm text-text-muted">Aucun message pour l&apos;instant.</p>}
        {sections.map((section) => (
          <div key={section.value} className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{section.label}</h3>
            <div className="flex flex-col gap-1">
              {section.messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.sender === "figurant"
                      ? "flex flex-col gap-1 rounded-xl border border-coral/40 bg-coral/10 px-4 py-2"
                      : "flex flex-col gap-1 rounded-xl border border-border bg-ink px-4 py-2"
                  }
                >
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>{m.sender === "staff" ? "Vous" : figurantPrenom}</span>
                    <span>
                      {formatDateTime(m.created_at)}
                      {m.sender === "staff" && (m.bien_recu ? " · Reçu" : " · En attente")}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.corps}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Catégorie :</span>
        <Select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value as FigurantMessageCategorie)}
          disabled={pending}
          className="w-auto"
        >
          {FIGURANT_MESSAGE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <textarea
        value={corps}
        onChange={(e) => setCorps(e.target.value)}
        rows={3}
        disabled={pending}
        placeholder="Écrire un message interne..."
        className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-50"
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={!figurantEmail}
          onClick={notify}
          title={figurantEmail ? undefined : "Pas d'email renseigné"}
        >
          Notifier par email
        </Button>
        <Button type="button" disabled={pending || !corps.trim()} onClick={send}>
          {pending ? "Envoi..." : "Envoyer"}
        </Button>
      </div>
    </div>
  );
}
