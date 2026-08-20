"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { revokeAccess } from "@/lib/equipe/actions";
import { formatDateShort } from "@/lib/format-date";

export type Membre = {
  id: string;
  created_at: string;
  projets: { id: string; nom: string } | null;
  profiles: { id: string; email: string | null; nom: string | null } | null;
};

export function MembresList({ membres }: { membres: Membre[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function revoke(id: string) {
    startTransition(async () => {
      await revokeAccess(id);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="px-6 py-3 font-medium">Assistant·e</th>
            <th className="px-6 py-3 font-medium">Projet</th>
            <th className="px-6 py-3 font-medium">Invité le</th>
            <th className="px-6 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {membres.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="px-6 py-3 font-medium">{m.profiles?.nom || m.profiles?.email || "—"}</td>
              <td className="px-6 py-3 text-text-muted">{m.projets?.nom ?? "—"}</td>
              <td className="px-6 py-3 text-text-muted">{formatDateShort(m.created_at)}</td>
              <td className="px-6 py-3 text-right">
                <Button type="button" variant="ghost" disabled={pending} onClick={() => revoke(m.id)}>
                  Révoquer
                </Button>
              </td>
            </tr>
          ))}
          {membres.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-10 text-center text-text-muted">
                Aucun·e assistant·e invité·e pour l&apos;instant.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
