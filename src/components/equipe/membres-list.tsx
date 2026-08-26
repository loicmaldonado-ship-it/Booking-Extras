"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { revokeAccess, updateAssistantSections } from "@/lib/equipe/actions";
import { formatDateShort } from "@/lib/format-date";
import { APP_SECTIONS, type SectionKey } from "@/lib/auth/sections";

export type Membre = {
  id: string;
  created_at: string;
  projets: { id: string; nom: string } | null;
  profiles: { id: string; email: string | null; nom: string | null; sections_autorisees: string[] | null } | null;
};

export function MembresList({ membres }: { membres: Membre[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // L'assistant·e dont le popover Sections est ouvert, avec la liste en
  // cours d'édition (pas encore enregistrée) — un seul appel serveur à la
  // fermeture plutôt qu'un aller-retour par case cochée/décochée.
  const [editing, setEditing] = useState<{ profileId: string; draft: string[] | null } | null>(null);

  function revoke(id: string) {
    startTransition(async () => {
      await revokeAccess(id);
      router.refresh();
    });
  }

  function openEditor(m: Membre) {
    const profileId = m.profiles?.id;
    if (!profileId) return;
    setEditing({ profileId, draft: m.profiles?.sections_autorisees ?? null });
  }

  function toggleDraftSection(section: SectionKey) {
    setEditing((prev) => {
      if (!prev) return prev;
      const base = prev.draft ?? APP_SECTIONS.map((s) => s.key);
      const next = base.includes(section) ? base.filter((s) => s !== section) : [...base, section];
      return { ...prev, draft: next };
    });
  }

  function saveAndClose() {
    if (!editing) return;
    const { profileId, draft } = editing;
    setEditing(null);
    startTransition(async () => {
      await updateAssistantSections(profileId, draft as SectionKey[] | null);
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
            <th className="px-6 py-3 font-medium">Sections</th>
            <th className="px-6 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {membres.map((m) => {
            const profileId = m.profiles?.id;
            const sections = m.profiles?.sections_autorisees ?? null;
            const isOpen = profileId != null && editing?.profileId === profileId;
            const draft = isOpen ? editing.draft : sections;
            return (
              <tr key={m.id} className="relative border-b border-border last:border-0">
                <td className="px-6 py-3 font-medium">{m.profiles?.nom || m.profiles?.email || "—"}</td>
                <td className="px-6 py-3 text-text-muted">{m.projets?.nom ?? "—"}</td>
                <td className="px-6 py-3 text-text-muted">{formatDateShort(m.created_at)}</td>
                <td className="px-6 py-3">
                  {profileId && (
                    <div className="relative inline-block">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => (isOpen ? setEditing(null) : openEditor(m))}
                      >
                        {sections === null ? "Accès complet" : `${sections.length} section${sections.length > 1 ? "s" : ""}`}
                      </Button>
                      {isOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-border bg-ink-raised p-3 shadow-lg">
                          <button
                            type="button"
                            onClick={() => setEditing({ profileId, draft: null })}
                            className="mb-2 text-xs text-coral hover:underline"
                          >
                            Accès complet (tout cocher)
                          </button>
                          <div className="flex flex-col gap-1.5">
                            {APP_SECTIONS.map((s) => (
                              <label key={s.key} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={draft === null || draft.includes(s.key)}
                                  onChange={() => toggleDraftSection(s.key)}
                                />
                                {s.label}
                              </label>
                            ))}
                          </div>
                          <Button type="button" disabled={pending} onClick={saveAndClose} className="mt-3 w-full">
                            {pending ? "Enregistrement..." : "Enregistrer"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => revoke(m.id)}>
                    Révoquer
                  </Button>
                </td>
              </tr>
            );
          })}
          {membres.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-10 text-center text-text-muted">
                Aucun·e assistant·e invité·e pour l&apos;instant.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
