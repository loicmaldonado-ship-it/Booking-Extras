"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markMessageBienRecu } from "@/lib/candidats/actions";
import { FIGURANT_MESSAGE_CATEGORIES, type FigurantMessage } from "@/lib/candidats/types";
import { formatDateTime } from "@/lib/format-date";

export function MessageThread({ messages }: { messages: FigurantMessage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function acknowledge(id: string) {
    startTransition(async () => {
      await markMessageBienRecu(id);
      router.refresh();
    });
  }

  const sections = FIGURANT_MESSAGE_CATEGORIES.map((c) => ({
    ...c,
    messages: messages.filter((m) => m.categorie === c.value),
  })).filter((s) => s.messages.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {sections.length === 0 && <p className="text-sm text-text-muted">Aucun message pour l&apos;instant.</p>}

      {sections.map((section) => (
        <div key={section.value} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{section.label}</h3>
          <div className="flex flex-col gap-2">
            {section.messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.sender === "staff"
                    ? "flex flex-col gap-2 rounded-xl border border-border bg-ink-raised px-4 py-3"
                    : "flex flex-col gap-2 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3"
                }
              >
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{m.sender === "staff" ? "Booking Extras" : "Vous"}</span>
                  <span>{formatDateTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.corps}</p>
                {m.sender === "staff" && (
                  <label className="flex w-fit items-center gap-1.5 text-xs font-medium text-yellow">
                    <input
                      type="checkbox"
                      checked={m.bien_recu}
                      disabled={m.bien_recu || pending}
                      onChange={() => acknowledge(m.id)}
                      className="h-4 w-4 rounded border-border accent-yellow"
                    />
                    BIEN REÇU
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {messages.some((m) => m.sender === "staff") && (
        <p className="border-t border-border pt-4 text-xs text-text-muted">
          Pour répondre, merci de le faire directement par email — cet espace ne sert qu&apos;à consulter vos
          messages et cocher « BIEN REÇU ».
        </p>
      )}
    </div>
  );
}
