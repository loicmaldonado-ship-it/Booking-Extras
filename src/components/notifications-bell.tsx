"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, FileText, MessageCircle, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDelai } from "@/lib/format-date";
import {
  getNotificationsPanel,
  markAllNotificationsLues,
  markNotificationLu,
} from "@/lib/notifications/actions";
import type { AppNotification, CandidatureATrier, NotificationType } from "@/lib/notifications/types";

const POLL_INTERVAL_MS = 60_000;

const TYPE_META: Record<NotificationType, { label: string; icon: LucideIcon; tone: string }> = {
  candidature: { label: "Candidatures", icon: FileText, tone: "text-coral" },
  reponse: { label: "Réponses", icon: MessageCircle, tone: "text-turquoise" },
  compte_cree: { label: "Comptes", icon: UserPlus, tone: "text-text" },
};

const FILTERS: { key: NotificationType | "tous"; label: string }[] = [
  { key: "tous", label: "Tout" },
  { key: "candidature", label: "Candidatures" },
  { key: "reponse", label: "Réponses" },
  { key: "compte_cree", label: "Comptes" },
];

function timeAgo(iso: string) {
  const delai = formatDelai(iso, new Date().toISOString());
  return delai === "à l'instant" ? delai : `il y a ${delai}`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [aTrier, setATrier] = useState<CandidatureATrier[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationType | "tous">("tous");
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const panel = await getNotificationsPanel();
    setNotifications(panel.notifications);
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

  function handleItemClick(n: AppNotification) {
    if (!n.lu_at) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, lu_at: new Date().toISOString() } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
      startTransition(() => {
        markNotificationLu(n.id);
      });
    }
    setOpen(false);
  }

  function handleMarkAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, lu_at: n.lu_at ?? now })));
    setUnreadCount(0);
    startTransition(() => {
      markAllNotificationsLues();
    });
  }

  const filtered = filter === "tous" ? notifications : notifications.filter((n) => n.type === filter);

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
        <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[75vh] w-80 flex-col overflow-hidden rounded-xl border border-border bg-ink-raised-2 shadow-xl sm:w-96">
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
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-coral text-ink"
                    : "text-text-muted hover:bg-ink-raised hover:text-text"
                )}
              >
                {f.label}
              </button>
            ))}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="ml-auto shrink-0 whitespace-nowrap text-xs font-medium text-text-muted hover:text-text"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-text-muted">Aucune notification.</p>
            ) : (
              filtered.map((n) => {
                const meta = TYPE_META[n.type];
                const Icon = meta.icon;
                const content = (
                  <div
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-raised",
                      !n.lu_at && "bg-coral/5"
                    )}
                  >
                    <Icon size={15} strokeWidth={1.75} className={cn("mt-0.5 shrink-0", meta.tone)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-snug text-text">{n.titre}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.lu_at && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />}
                  </div>
                );
                return n.lien ? (
                  <Link key={n.id} href={n.lien} onClick={() => handleItemClick(n)} className="block">
                    {content}
                  </Link>
                ) : (
                  <button key={n.id} type="button" onClick={() => handleItemClick(n)} className="block w-full">
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
