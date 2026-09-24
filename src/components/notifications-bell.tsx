"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ChevronDown, FileText, MessageCircle, UserPlus, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDelai } from "@/lib/format-date";
import {
  getNotificationsPanel,
  markAllNotificationsLues,
  markNotificationsLues,
} from "@/lib/notifications/actions";
import type { AppNotification, CandidatureATrier, NotificationGroup, NotificationType } from "@/lib/notifications/types";

const POLL_INTERVAL_MS = 60_000;

const TYPE_META: Record<NotificationType, { label: string; icon: LucideIcon; tone: string }> = {
  candidature: { label: "Candidatures", icon: FileText, tone: "text-coral" },
  reponse: { label: "Réponses", icon: MessageCircle, tone: "text-turquoise" },
  compte_cree: { label: "Comptes", icon: UserPlus, tone: "text-text" },
  casting: { label: "Casting", icon: Video, tone: "text-yellow" },
};

const FILTERS: { key: NotificationType | "tous"; label: string }[] = [
  { key: "tous", label: "Tout" },
  { key: "candidature", label: "Candidatures" },
  { key: "reponse", label: "Réponses" },
  { key: "compte_cree", label: "Comptes" },
  { key: "casting", label: "Casting" },
];

function timeAgo(iso: string) {
  const delai = formatDelai(iso, new Date().toISOString());
  return delai === "à l'instant" ? delai : `il y a ${delai}`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [aTrier, setATrier] = useState<CandidatureATrier[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationType | "tous">("tous");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const panel = await getNotificationsPanel();
    setGroups(panel.groups);
    setATrier(panel.aTrier);
    setUnreadCount(panel.unreadCount);
  }

  useEffect(() => {
    const timeout = setTimeout(refresh, 0);
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(refresh, 0);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Marque lus localement tout de suite (compteur, points), l'enregistrement
  // suit ; le prochain rafraîchissement regroupe ces lignes avec les lues.
  function markRead(items: AppNotification[]) {
    const ids = items.filter((n) => !n.lu_at).map((n) => n.id);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setGroups((prev) =>
      prev.map((g) => {
        const touched = g.items.some((n) => ids.includes(n.id));
        if (!touched) return g;
        const newItems = g.items.map((n) => (ids.includes(n.id) ? { ...n, lu_at: now } : n));
        return { ...g, items: newItems, nonLu: newItems.some((n) => !n.lu_at) };
      })
    );
    setUnreadCount((c) => Math.max(0, c - ids.length));
    startTransition(() => {
      markNotificationsLues(ids);
    });
  }

  function handleMarkAllRead() {
    const now = new Date().toISOString();
    setGroups((prev) =>
      prev.map((g) => ({ ...g, nonLu: false, items: g.items.map((n) => ({ ...n, lu_at: n.lu_at ?? now })) }))
    );
    setUnreadCount(0);
    startTransition(() => {
      markAllNotificationsLues();
    });
  }

  const filtered = filter === "tous" ? groups : groups.filter((g) => g.type === filter);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-muted transition-colors hover:border-coral/60 hover:text-text"
        aria-label="Notifications"
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-semibold text-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-xl border border-border bg-ink-raised-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text transition-colors hover:border-coral/60"
              >
                <CheckCheck size={13} strokeWidth={2} />
                Tout marquer comme lu
              </button>
            ) : (
              <span className="text-xs text-text-muted">Tout est lu</span>
            )}
          </div>

          {aTrier.length > 0 && (
            <div className="flex flex-col gap-1.5 border-b border-border bg-ink-raised px-3 py-2.5">
              {aTrier.map((a) => (
                <Link
                  key={a.annonce_id}
                  href={`/candidatures?annonce_id=${a.annonce_id}&onglet_id=a_trier`}
                  onClick={() => setOpen(false)}
                  className="text-xs font-medium text-coral hover:underline"
                >
                  Vous avez {a.count} candidature{a.count > 1 ? "s" : ""} à trier dans « {a.annonce_titre} »
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-2">
            {FILTERS.filter((f) => f.key === "tous" || groups.some((g) => g.type === f.key)).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-coral text-ink" : "text-text-muted hover:bg-ink-raised hover:text-text"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-text-muted">Aucune notification.</p>
            ) : (
              filtered.map((g) => {
                const meta = TYPE_META[g.type];
                const Icon = meta.icon;
                const multiple = g.items.length > 1;
                const isOpen = expanded === g.key;
                const row = (
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <Icon size={15} strokeWidth={1.75} className={cn("mt-0.5 shrink-0", meta.tone)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs leading-snug text-text", g.nonLu && "font-semibold")}>{g.titre}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {multiple ? "dernière " : ""}
                        {timeAgo(g.latestAt)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <div key={g.key} className={cn("border-b border-border/50 last:border-0", g.nonLu && "bg-coral/5")}>
                    <div className="flex items-start gap-1 px-3 py-2.5 transition-colors hover:bg-ink-raised">
                      {g.lien ? (
                        <Link
                          href={g.lien}
                          onClick={() => {
                            markRead(g.items);
                            setOpen(false);
                          }}
                          className="flex min-w-0 flex-1"
                        >
                          {row}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (multiple ? setExpanded(isOpen ? null : g.key) : markRead(g.items))}
                          className="flex min-w-0 flex-1 text-left"
                        >
                          {row}
                        </button>
                      )}
                      {g.nonLu && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />}
                      {multiple && (
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : g.key)}
                          aria-label={isOpen ? "Masquer le détail" : "Voir le détail"}
                          aria-expanded={isOpen}
                          className="-mr-1 flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-ink-raised-2 hover:text-text"
                        >
                          {g.items.length}
                          <ChevronDown size={12} className={cn("transition-transform", isOpen && "rotate-180")} />
                        </button>
                      )}
                    </div>
                    {multiple && isOpen && (
                      <ul className="flex flex-col pb-1.5 pl-9 pr-3">
                        {g.items.map((n) => (
                          <li key={n.id}>
                            {n.lien ? (
                              <Link
                                href={n.lien}
                                onClick={() => {
                                  markRead([n]);
                                  setOpen(false);
                                }}
                                className="flex items-baseline justify-between gap-2 rounded px-1.5 py-1 text-[11px] text-text-muted hover:bg-ink-raised hover:text-text"
                              >
                                <span className="truncate">{n.titre}</span>
                                <span className="shrink-0 text-[10px]">{timeAgo(n.created_at)}</span>
                              </Link>
                            ) : (
                              <div className="flex items-baseline justify-between gap-2 px-1.5 py-1 text-[11px] text-text-muted">
                                <span className="truncate">{n.titre}</span>
                                <span className="shrink-0 text-[10px]">{timeAgo(n.created_at)}</span>
                              </div>
                            )}
                          </li>
                        ))}
                        {g.nonLu && (
                          <li>
                            <button
                              type="button"
                              onClick={() => markRead(g.items)}
                              className="px-1.5 py-1 text-[11px] font-medium text-coral hover:underline"
                            >
                              Marquer ce groupe comme lu
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
