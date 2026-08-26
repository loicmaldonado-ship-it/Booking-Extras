"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AvatarPresence } from "@/components/equipe/avatar-presence";

export type PresenceMember = {
  id: string;
  nom: string | null;
  email: string | null;
  role: "chef" | "assistant";
  avatarUrl: string | null;
  online: boolean;
};

const REFRESH_MS = 30_000;

export function TeamPresenceList({ title, members }: { title: string; members: PresenceMember[] }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  const sorted = [...members].sort((a, b) => Number(b.online) - Number(a.online));
  const onlineCount = members.filter((m) => m.online).length;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-text-muted">
          {onlineCount} connecté·e{onlineCount > 1 ? "s" : ""} / {members.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-4">
        {sorted.map((m) => (
          <div key={m.id} className="flex flex-col items-center gap-1.5 text-center">
            <AvatarPresence avatarUrl={m.avatarUrl} nom={m.nom} email={m.email} online={m.online} size={48} />
            <span className="max-w-[6rem] truncate text-xs font-medium">{m.nom || m.email}</span>
            <span className="text-[10px] text-text-muted">{m.role === "chef" ? "Chef·fe" : "Assistant·e"}</span>
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-text-muted">Personne pour l&apos;instant.</p>}
      </div>
    </Card>
  );
}
