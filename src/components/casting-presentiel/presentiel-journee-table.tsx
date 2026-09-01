"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { StatusSelect } from "@/components/ui/status-select";
import { Select, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ContactIcons } from "@/components/ui/contact-icons";
import { PreviewButton, type PreviewItem } from "@/components/figurants/figurant-preview-modal";
import { substituteTokens } from "@/lib/bookings/convocation";
import { statutTone, type BookingStatut } from "@/lib/bookings/types";
import {
  removePresentielEntry,
  updatePresentielStatut,
  updatePresentielStatutBulk,
  updatePresentielEntryRole,
  updatePresentielEntryNotes,
} from "@/lib/casting-presentiel/actions";
import { EntryNotesField } from "@/components/casting/entry-notes-field";
import { recordCastingMessage } from "@/lib/casting/actions";
import { defaultPresentielConvocationMessage } from "@/lib/casting-presentiel/message-template";
import { CASTING_STATUTS } from "@/lib/casting/types";
import type { PresentielEntry } from "@/lib/casting-presentiel/types";
import type { Creneau } from "@/components/essayages/creneaux-panel";

type RoleOption = { id: string; nom: string };

function heureLabel(h: string) {
  return h.slice(0, 5);
}

export function PresentielJourneeTable({
  rows,
  roles = [],
  creneaux = [],
  lieu,
  dateLabel,
  projetId,
  projetNom,
  signature,
}: {
  rows: PresentielEntry[];
  roles?: RoleOption[];
  creneaux?: Creneau[];
  lieu?: string | null;
  dateLabel?: string;
  projetId?: string;
  projetNom?: string;
  signature?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(`Convocation casting — ${projetNom ?? ""}`);
  const [message, setMessage] = useState(defaultPresentielConvocationMessage());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [bulkStatut, setBulkStatut] = useState<BookingStatut | "">("");
  const [bulkStatutError, setBulkStatutError] = useState<string | null>(null);

  const previewItems: PreviewItem[] = rows.map((r) => ({
    id: r.figurant_id,
    prenom: r.figurants?.prenom ?? "",
    nom: r.figurants?.nom ?? "",
    ville: null,
    portraitUrl: r.portraitUrl,
  }));

  function remove(id: string) {
    startTransition(async () => {
      await removePresentielEntry(id);
      router.refresh();
    });
  }

  function changeStatut(id: string, statut: BookingStatut) {
    startTransition(async () => {
      await updatePresentielStatut(id, statut);
      router.refresh();
    });
  }

  function applyBulkStatut() {
    if (!bulkStatut) return;
    setBulkStatutError(null);
    const entryIds = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
    startTransition(async () => {
      const result = await updatePresentielStatutBulk(entryIds, bulkStatut);
      if (result?.error) setBulkStatutError(result.error);
      else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function changeRole(id: string, roleId: string) {
    startTransition(async () => {
      await updatePresentielEntryRole(id, roleId || null);
      router.refresh();
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function horaireFor(r: PresentielEntry) {
    const c = creneaux.find((c) => c.id === r.creneau_id);
    if (!c) return `${dateLabel ?? ""} — créneau à définir`.trim();
    return `${dateLabel ? `${dateLabel} de ` : ""}${heureLabel(c.heure_debut)} à ${heureLabel(c.heure_fin)}`;
  }

  function tokensFor(r: PresentielEntry) {
    return {
      prenom: r.figurants?.prenom ?? "",
      projet: projetNom ?? "",
      lieu: lieu ?? "Lieu à confirmer",
      horaire: horaireFor(r),
      signature: signature ?? "",
    };
  }

  function sendTo(r: PresentielEntry) {
    if (!r.figurants?.email || !message.trim()) return;
    const tk = tokensFor(r);
    const body = substituteTokens(message, tk);
    const subj = substituteTokens(subject, tk);
    setSendError(null);
    startTransition(async () => {
      const result = await recordCastingMessage(r.figurant_id, body, r.figurants!.email, subj, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
    });
    setSent((prev) => new Set([...prev, r.id]));
  }

  function sendToAll() {
    for (const r of rows.filter((r) => selected.has(r.id) && r.figurants?.email && !sent.has(r.id))) {
      sendTo(r);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-ink-raised p-3 text-center"
          >
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggleSelect(r.id)}
              className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-border accent-coral"
            />
            <button
              type="button"
              onClick={() => remove(r.id)}
              disabled={pending}
              className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-text-muted hover:bg-danger hover:text-ink"
              title="Retirer de cette journée"
            >
              ×
            </button>
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
              {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
              {r.statut === "valide" && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-turquoise text-xs text-ink"
                  title="Validé"
                >
                  ✓
                </span>
              )}
            </div>
            <div className="text-sm font-medium">
              {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
            </div>
            {roles.length > 0 ? (
              <Select
                value={r.role_id ?? ""}
                onChange={(e) => changeRole(r.id, e.target.value)}
                disabled={pending}
                className="w-full text-xs"
              >
                <option value="">Rôle (aucun)</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nom}
                  </option>
                ))}
              </Select>
            ) : (
              r.casting_roles && <div className="text-[10px] text-coral">{r.casting_roles.nom}</div>
            )}
            <StatusSelect
              value={r.statut}
              tone={statutTone(r.statut)}
              disabled={pending}
              onChange={(e) => changeStatut(r.id, e.target.value as BookingStatut)}
            >
              {CASTING_STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </StatusSelect>
            <div className="flex items-center gap-1">
              <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} />
              <PreviewButton items={previewItems} index={i} />
            </div>
            <EntryNotesField initialValue={r.notes} onSave={(notes) => updatePresentielEntryNotes(r.id, notes)} />
          </div>
        ))}
        {rows.length === 0 && (
          <p className="col-span-full py-10 text-center text-text-muted">Aucun profil pour cette journée.</p>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-ink px-3 py-2">
            <span className="text-xs font-medium text-text-muted">Statut :</span>
            <Select
              value={bulkStatut}
              onChange={(e) => setBulkStatut(e.target.value as BookingStatut)}
              className="w-44 text-xs"
            >
              <option value="">Choisir...</option>
              {CASTING_STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" disabled={pending || !bulkStatut} onClick={applyBulkStatut}>
              Appliquer à {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </Button>
            {bulkStatutError && <span className="text-xs text-danger">{bulkStatutError}</span>}
          </div>
          {sendError && <p className="text-sm text-danger">{sendError}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              Convocation pour {selected.size} sélectionné·e{selected.size > 1 ? "s" : ""}
            </span>
            <Button type="button" variant="secondary" disabled={!message.trim()} onClick={sendToAll}>
              Envoyer à tous
            </Button>
          </div>
          <p className="text-xs text-text-muted">
            {"{lieu}"} et {"{horaire}"} sont remplis automatiquement par profil (lieu de la journée, créneau
            assigné).
          </p>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet" />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
          />
          <div className="flex flex-col gap-2">
            {rows
              .filter((r) => selected.has(r.id))
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {r.figurants?.prenom} {r.figurants?.nom}
                    {!r.figurants?.email && <span className="ml-2 text-xs text-text-muted">Pas d&apos;email</span>}
                  </span>
                  <Button
                    type="button"
                    variant={sent.has(r.id) ? "ghost" : "secondary"}
                    disabled={!r.figurants?.email || !message.trim()}
                    onClick={() => sendTo(r)}
                  >
                    {sent.has(r.id) ? "Envoyé" : `Envoyer à ${r.figurants?.prenom ?? ""}`}
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
