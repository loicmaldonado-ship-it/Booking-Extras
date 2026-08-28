"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markMessageBienRecu } from "@/lib/candidats/actions";
import { FIGURANT_MESSAGE_CATEGORIES, type FigurantMessage } from "@/lib/candidats/types";
import { formatDateTime } from "@/lib/format-date";

type ProjetInfo = { label: string; archive: boolean };

function CategorySections({
  messages,
  pending,
  onAcknowledge,
}: {
  messages: FigurantMessage[];
  pending: boolean;
  onAcknowledge: (id: string) => void;
}) {
  const sections = FIGURANT_MESSAGE_CATEGORIES.map((c) => ({
    ...c,
    messages: messages.filter((m) => m.categorie === c.value),
  })).filter((s) => s.messages.length > 0);

  return (
    <>
      {sections.map((section) => (
        <div key={section.value} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{section.label}</h4>
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
                      onChange={() => onAcknowledge(m.id)}
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
    </>
  );
}

export function MessageThread({
  messages,
  projetInfoById = {},
}: {
  messages: FigurantMessage[];
  projetInfoById?: Record<string, ProjetInfo>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function acknowledge(id: string) {
    startTransition(async () => {
      await markMessageBienRecu(id);
      router.refresh();
    });
  }

  // Groupé par projet (le plus récent en premier, ouvert par défaut — les
  // autres repliés) puis par catégorie à l'intérieur — sinon tous les
  // messages de tous les projets s'empilent d'un coup, illisible dès qu'on
  // a postulé sur plusieurs tournages.
  const groups = new Map<string, { label: string; archive: boolean; messages: FigurantMessage[]; lastAt: string }>();
  const sansProjet: FigurantMessage[] = [];
  for (const m of messages) {
    if (!m.projet_id) {
      sansProjet.push(m);
      continue;
    }
    const info = projetInfoById[m.projet_id];
    const entry = groups.get(m.projet_id) ?? {
      label: info?.label ?? "Projet",
      archive: info?.archive ?? false,
      messages: [],
      lastAt: m.created_at,
    };
    entry.messages.push(m);
    if (m.created_at > entry.lastAt) entry.lastAt = m.created_at;
    groups.set(m.projet_id, entry);
  }
  const projetGroups = Array.from(groups.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  if (messages.length === 0) {
    return <p className="text-sm text-text-muted">Aucun message pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {projetGroups.map((group, i) => (
        <details key={group.label + group.lastAt} open={i === 0} className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
            <span>
              {group.label}
              {group.archive && <span className="ml-2 text-xs font-normal text-text-muted">(archivé)</span>}
            </span>
            <span className="text-text-muted transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-4 py-3">
            <CategorySections messages={group.messages} pending={pending} onAcknowledge={acknowledge} />
          </div>
        </details>
      ))}

      {sansProjet.length > 0 && (
        <details open={projetGroups.length === 0} className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
            <span>Sans projet</span>
            <span className="text-text-muted transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-4 py-3">
            <CategorySections messages={sansProjet} pending={pending} onAcknowledge={acknowledge} />
          </div>
        </details>
      )}

      {messages.some((m) => m.sender === "staff") && (
        <p className="border-t border-border pt-4 text-xs text-text-muted">
          Pour répondre, merci de le faire directement par email — cet espace ne sert qu&apos;à consulter vos
          messages et cocher « BIEN REÇU ».
        </p>
      )}
    </div>
  );
}
