"use client";

import { useEffect, useState } from "react";
import { AvatarPresence } from "@/components/equipe/avatar-presence";
import { fetchMyTeamPresence } from "@/lib/auth/team-presence-actions";
import type { PresenceMember } from "@/components/equipe/team-presence-list";

const POLL_INTERVAL_MS = 60_000;

// Juste les têtes, sans nom — pensé pour tenir dans le bandeau du header.
// N'affiche rien pour une assistante (pas d'"équipe" au sens de la page
// Équipe, réservée aux chef·fes) ni tant que le premier chargement n'a pas
// renvoyé de membres.
export function TeamPresenceStrip() {
  const [members, setMembers] = useState<PresenceMember[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const data = await fetchMyTeamPresence();
      if (!cancelled) setMembers(data);
    }
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!members || members.length === 0) return null;

  return (
    <div className="hidden items-center -space-x-2 md:flex">
      {members.map((m) => (
        <div key={m.id} className="rounded-full ring-2 ring-ink-raised" title={`${m.nom || m.email}${m.online ? " · connecté·e" : " · hors ligne"}`}>
          <AvatarPresence avatarUrl={m.avatarUrl} nom={m.nom} email={m.email} online={m.online} size={28} variant="dot-always" />
        </div>
      ))}
    </div>
  );
}
