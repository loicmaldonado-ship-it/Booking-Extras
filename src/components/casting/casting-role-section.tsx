"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { substituteTokens } from "@/lib/bookings/convocation";
import { deleteCastingRole, recordCastingMessage } from "@/lib/casting/actions";
import { defaultCastingInviteMessage } from "@/lib/casting/message-template";
import { formatDateLong } from "@/lib/format-date";
import { CastingEntryManageCard } from "@/components/casting/casting-entry-manage-card";
import { CastingRoleForm } from "@/components/casting/casting-role-form";
import { QuickAddFigurantCasting } from "@/components/casting/quick-add-figurant-casting";
import { CATEGORIE_CACHET_LABELS, type CastingRole, type CastingEntry } from "@/lib/casting/types";
import type { CastingEntryPhoto } from "@/lib/casting/data";
import type { MessageTemplate } from "@/lib/templates/types";

const DEFAULT_BODY = "Bonjour {prenom},\n\n";

export function CastingRoleSection({
  projetId,
  projetNom,
  origin,
  role,
  entries,
  portraitByFigurant,
  videoUrlsByEntry,
  entryPhotosByEntry,
  allFigurants,
  templates,
}: {
  projetId: string;
  projetNom: string;
  origin: string;
  role: CastingRole;
  entries: CastingEntry[];
  portraitByFigurant: Map<string, string | null>;
  videoUrlsByEntry: Map<string, { path: string; url: string }[]>;
  entryPhotosByEntry: Map<string, CastingEntryPhoto[]>;
  allFigurants: { id: string; prenom: string; nom: string }[];
  templates: MessageTemplate[];
}) {
  const router = useRouter();
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSubject, setBulkSubject] = useState(`Booking Extras — casting « ${role.nom} »`);
  const [bulkMessage, setBulkMessage] = useState(() => defaultCastingInviteMessage(role));
  const [sentBulk, setSentBulk] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);

  const submitted = entries.filter((e) => e.submitted_at).length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function tokens(entry: CastingEntry) {
    return {
      prenom: entry.figurants?.prenom ?? "",
      projet: projetNom,
      role: role.nom,
      date: role.date_tournage ? formatDateLong(role.date_tournage) : "",
      signature: "",
      lien: `${origin}/casting/upload/${entry.request_token}`,
    };
  }

  function applyTemplate(t?: MessageTemplate) {
    setBulkSubject(t ? t.sujet : `Casting « ${role.nom} »`);
    setBulkMessage(t ? t.corps : DEFAULT_BODY);
  }

  function applyInviteTemplate() {
    setBulkSubject(`Booking Extras — casting « ${role.nom} »`);
    setBulkMessage(defaultCastingInviteMessage(role));
  }

  function sendTo(entry: CastingEntry) {
    if (!entry.figurants?.email || !bulkMessage.trim()) return;
    const tk = tokens(entry);
    const body = substituteTokens(bulkMessage, tk);
    const subj = substituteTokens(bulkSubject, tk);
    setSendError(null);
    startTransition(async () => {
      const result = await recordCastingMessage(entry.figurant_id, body, entry.figurants!.email, subj, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${entry.figurants!.prenom} : ${result.error}`);
    });
    setSentBulk((prev) => new Set([...prev, entry.id]));
  }

  function sendToAll() {
    for (const entry of entries.filter((e) => selected.has(e.id) && e.figurants?.email && !sentBulk.has(e.id))) {
      sendTo(entry);
    }
  }

  function removeRole() {
    startTransition(async () => {
      await deleteCastingRole(role.id);
      router.refresh();
    });
  }

  const calibrationSummary = [
    role.nb_videos > 0 ? `${role.nb_videos} vidéo${role.nb_videos > 1 ? "s" : ""}` : null,
    role.photo_labels.length > 0 ? `${role.photo_labels.length} photo${role.photo_labels.length > 1 ? "s" : ""}` : null,
    role.demande_bande_demo ? "bande démo" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{role.nom}</h2>
          <p className="text-xs text-text-muted">
            {role.date_tournage ? formatDateLong(role.date_tournage) : "Date de tournage non définie"}
            {calibrationSummary ? ` · ${calibrationSummary}` : ""}
          </p>
          <div className="mt-1 flex gap-1.5">
            <Badge>{CATEGORIE_CACHET_LABELS[role.categorie_cachet]}</Badge>
            <Badge tone="turquoise">{submitted} envoyé{submitted > 1 ? "s" : ""}</Badge>
            <Badge tone="yellow">{entries.length - submitted} en attente</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setCalibrateOpen((v) => !v)}>
            {calibrateOpen ? "Fermer" : "Calibrer"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={removeRole}>
            Supprimer le rôle
          </Button>
        </div>
      </div>

      {calibrateOpen && (
        <div className="rounded-xl border border-border bg-ink px-4 py-3">
          <CastingRoleForm projetId={projetId} role={role} />
        </div>
      )}

      <QuickAddFigurantCasting
        roleId={role.id}
        figurants={allFigurants}
        alreadyAddedIds={entries.map((e) => e.figurant_id)}
      />

      <div className="flex flex-wrap gap-3">
        {entries.map((entry) => (
          <CastingEntryManageCard
            key={entry.id}
            entry={entry}
            portraitUrl={portraitByFigurant.get(entry.figurant_id) ?? null}
            videoUrls={videoUrlsByEntry.get(entry.id) ?? []}
            photoLabels={role.photo_labels}
            photos={entryPhotosByEntry.get(entry.id) ?? []}
            selected={selected.has(entry.id)}
            onToggleSelect={() => toggleSelect(entry.id)}
          />
        ))}
        {entries.length === 0 && <p className="text-sm text-text-muted">Aucun profil dans ce rôle pour l&apos;instant.</p>}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          {sendError && <p className="text-sm text-danger">{sendError}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              Message pour {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </span>
            <Button type="button" variant="secondary" disabled={!bulkMessage.trim()} onClick={sendToAll}>
              Envoyer à tous
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">Modèle :</span>
            <button
              type="button"
              onClick={applyInviteTemplate}
              className="rounded-full border border-coral/60 bg-coral/10 px-3 py-1 text-xs font-medium text-coral hover:bg-coral/20"
            >
              Invitation (avec le lien)
            </button>
            <button
              type="button"
              onClick={() => applyTemplate()}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:text-text"
            >
              Vierge
            </button>
            {templates.length > 0 &&
              templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
                >
                  {t.nom}
                </button>
              ))}
          </div>
          <Input value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} placeholder="Sujet" />
          <textarea
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
          />
          <div className="flex flex-col gap-2">
            {entries
              .filter((e) => selected.has(e.id))
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {e.figurants?.prenom} {e.figurants?.nom}
                    {!e.figurants?.email && <span className="ml-2 text-xs text-text-muted">Pas d&apos;email</span>}
                  </span>
                  <Button
                    type="button"
                    variant={sentBulk.has(e.id) ? "ghost" : "secondary"}
                    disabled={!e.figurants?.email || !bulkMessage.trim()}
                    onClick={() => sendTo(e)}
                  >
                    {sentBulk.has(e.id) ? "Envoyé" : `Envoyer à ${e.figurants?.prenom ?? ""}`}
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
}
