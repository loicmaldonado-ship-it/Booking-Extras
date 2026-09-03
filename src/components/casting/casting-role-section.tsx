"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/field";
import { substituteTokens, substituteTokensHtml } from "@/lib/bookings/convocation";
import {
  deleteCastingRole,
  setCastingRolePosition,
  recordCastingMessage,
  recordCastingMessagesBulk,
  updateAllCastingEntriesVisiblePartage,
  updateCastingEntriesStatutBulk,
  updateCastingRoleVisiblePartage,
} from "@/lib/casting/actions";
import { cn } from "@/lib/cn";
import { sendFigurantsToPresentiel } from "@/lib/casting-presentiel/actions";
import { defaultCastingInviteMessage, defaultCastingPresentielMessage } from "@/lib/casting/message-template";
import { formatDateLong, formatDateShort } from "@/lib/format-date";
import { CastingEntryManageCard } from "@/components/casting/casting-entry-manage-card";
import type { PreviewItem } from "@/components/figurants/figurant-preview-modal";
import { CastingRoleForm } from "@/components/casting/casting-role-form";
import { QuickAddFigurantCasting } from "@/components/casting/quick-add-figurant-casting";
import {
  CATEGORIE_CACHET_LABELS,
  CASTING_MODE_LABELS,
  CASTING_STATUTS,
  formatTournageLabel,
  formatTournageClause,
  type CastingRole,
  type CastingEntry,
} from "@/lib/casting/types";
import type { BookingStatut } from "@/lib/bookings/types";
import type { CastingEntryPhoto } from "@/lib/casting/data";
import type { MessageTemplate } from "@/lib/templates/types";
import type { PresentielJourneeAvecCreneaux, PresentielAssignment } from "@/lib/casting-presentiel/journees";

const DEFAULT_BODY = "Bonjour {prenom},\n\n";

export function CastingRoleSection({
  projetId,
  projetNom,
  origin,
  signature,
  role,
  entries,
  portraitByFigurant,
  videoUrlsByEntry,
  entryPhotosByEntry,
  allFigurants,
  templates,
  presentielJournees,
  presentielAssignments,
  position,
}: {
  projetId: string;
  projetNom: string;
  origin: string;
  signature: string;
  role: CastingRole;
  entries: CastingEntry[];
  portraitByFigurant: Map<string, string | null>;
  videoUrlsByEntry: Map<string, { path: string; url: string }[]>;
  entryPhotosByEntry: Map<string, CastingEntryPhoto[]>;
  allFigurants: { id: string; prenom: string; nom: string }[];
  templates: MessageTemplate[];
  presentielJournees: PresentielJourneeAvecCreneaux[];
  presentielAssignments: Map<string, PresentielAssignment>;
  // Position 1-indexée dans l'ordre d'affichage actuel du projet — pas
  // juste role.ordre brut (qui peut être décalé/non contigu) : ce que le
  // champ numéro doit montrer et permettre de changer directement.
  position: number;
}) {
  const router = useRouter();
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSubject, setBulkSubject] = useState(`Booking Extras — casting « ${role.nom} »`);
  const [bulkMessage, setBulkMessage] = useState(() => defaultCastingInviteMessage(role));
  const [sentBulk, setSentBulk] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  const [presentielJourneeId, setPresentielJourneeId] = useState("");
  const [presentielCreneauId, setPresentielCreneauId] = useState("");
  const [presentielResult, setPresentielResult] = useState<string | null>(null);
  const [presentielError, setPresentielError] = useState<string | null>(null);
  const [bulkStatut, setBulkStatut] = useState<BookingStatut | "">("");
  const [bulkStatutError, setBulkStatutError] = useState<string | null>(null);

  const submitted = entries.filter((e) => e.submitted_at).length;

  // Aperçu popup (bookings + échanges) — un item par entrée de casting.
  const previewItems: PreviewItem[] = entries.map((e) => ({
    id: e.figurant_id,
    prenom: e.figurants?.prenom ?? "",
    nom: e.figurants?.nom ?? "",
    ville: null,
    portraitUrl: portraitByFigurant.get(e.figurant_id) ?? null,
  }));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = entries.length > 0 && selected.size === entries.length;

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)));
  }

  function tokens(entry: CastingEntry) {
    const assignment = presentielAssignments.get(entry.figurant_id);
    return {
      prenom: entry.figurants?.prenom ?? "",
      projet: projetNom,
      role: role.nom,
      date: formatTournageClause(role.date_tournage, role.date_tournage_fin),
      deadline: role.date_limite_envoi ? formatDateLong(role.date_limite_envoi) : "",
      signature,
      lien: `${origin}/casting/upload/${entry.request_token}`,
      lieu: assignment?.lieu ?? "Lieu à confirmer",
      horaire: assignment ? `${assignment.dateLabel}${assignment.heureLabel ? ` de ${assignment.heureLabel}` : " — créneau à définir"}` : "Créneau à définir",
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

  function applyPresentielTemplate() {
    setBulkSubject(`Convocation casting — ${role.nom}`);
    setBulkMessage(defaultCastingPresentielMessage());
  }

  function sendTo(entry: CastingEntry) {
    if (!entry.figurants?.email || !bulkMessage.trim()) return;
    const tk = tokens(entry);
    const body = substituteTokens(bulkMessage, tk);
    const subj = substituteTokens(bulkSubject, tk);
    const html = substituteTokensHtml(bulkMessage, tk, { bold: ["role", "projet"], italic: ["signature"] });
    setSendError(null);
    startTransition(async () => {
      const result = await recordCastingMessage(entry.figurant_id, body, entry.figurants!.email, subj, projetId, {
        agentEmail: entry.figurants?.agent_email,
        rolePdfPath: role.pdf_storage_path,
        rolePdfFilename: role.pdf_filename,
        html,
      });
      if (result?.error) setSendError(`Échec de l'envoi à ${entry.figurants!.prenom} : ${result.error}`);
    });
    setSentBulk((prev) => new Set([...prev, entry.id]));
  }

  function sendToAll() {
    const targets = entries.filter((e) => selected.has(e.id) && e.figurants?.email && !sentBulk.has(e.id));
    if (targets.length === 0 || !bulkMessage.trim()) return;

    const payload = targets.map((entry) => {
      const tk = tokens(entry);
      return {
        figurantId: entry.figurant_id,
        email: entry.figurants!.email!,
        agentEmail: entry.figurants?.agent_email,
        subject: substituteTokens(bulkSubject, tk),
        corps: substituteTokens(bulkMessage, tk),
        html: substituteTokensHtml(bulkMessage, tk, { bold: ["role", "projet"], italic: ["signature"] }),
      };
    });
    setSendError(null);
    startTransition(async () => {
      const { results } = await recordCastingMessagesBulk(payload, projetId, {
        rolePdfPath: role.pdf_storage_path,
        rolePdfFilename: role.pdf_filename,
      });
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        setSendError(`Échec de l'envoi pour ${errors.length} profil${errors.length > 1 ? "s" : ""}.`);
      }
    });
    setSentBulk((prev) => new Set([...prev, ...targets.map((e) => e.id)]));
  }

  const selectedJournee = presentielJournees.find((j) => j.id === presentielJourneeId);

  function sendToPresentiel() {
    if (!presentielJourneeId) return;
    setPresentielError(null);
    setPresentielResult(null);
    const figurantIds = entries.filter((e) => selected.has(e.id)).map((e) => e.figurant_id);
    startTransition(async () => {
      const result = await sendFigurantsToPresentiel(
        figurantIds,
        projetId,
        presentielJourneeId,
        presentielCreneauId || null,
        role.id
      );
      if (result?.error) setPresentielError(result.error);
      else {
        setPresentielResult(
          `${result?.ok ?? 0} ajouté${(result?.ok ?? 0) > 1 ? "s" : ""}${result?.deja ? `, ${result.deja} déjà présent(s)` : ""}.`
        );
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function applyBulkStatut() {
    if (!bulkStatut) return;
    setBulkStatutError(null);
    const entryIds = entries.filter((e) => selected.has(e.id)).map((e) => e.id);
    startTransition(async () => {
      const result = await updateCastingEntriesStatutBulk(entryIds, bulkStatut);
      if (result?.error) setBulkStatutError(result.error);
      else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function removeRole() {
    startTransition(async () => {
      await deleteCastingRole(role.id);
      router.refresh();
    });
  }

  function changeRoleVisible(visible: boolean) {
    if (visible === role.visible_partage) return;
    startTransition(async () => {
      await updateCastingRoleVisiblePartage(role.id, visible);
      router.refresh();
    });
  }

  function changeAllEntriesVisible(visible: boolean) {
    startTransition(async () => {
      await updateAllCastingEntriesVisiblePartage(role.id, visible);
      router.refresh();
    });
  }

  function changePosition(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === position) return;
    startTransition(async () => {
      await setCastingRolePosition(role.id, n);
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

  const deadlinePassed = !!role.date_limite_envoi && role.date_limite_envoi < new Date().toISOString().slice(0, 10);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <input
              key={position}
              type="number"
              min={1}
              disabled={pending}
              defaultValue={position}
              onBlur={(e) => changePosition(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              title="N° d'ordre — change ce chiffre pour déplacer le rôle"
              className="w-12 rounded-lg border border-border bg-ink px-1.5 py-1 text-center text-sm font-semibold outline-none focus:border-coral disabled:opacity-50"
            />
            <h2 className="text-lg font-semibold">{role.nom}</h2>
          </div>
          <p className="text-xs text-text-muted">
            {formatTournageLabel(role.date_tournage, role.date_tournage_fin) ?? "Date de tournage non définie"}
            {role.date_limite_envoi ? ` · Envoi avant le ${formatDateLong(role.date_limite_envoi)}` : ""}
            {calibrationSummary ? ` · ${calibrationSummary}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{CATEGORIE_CACHET_LABELS[role.categorie_cachet]}</Badge>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => changeRoleVisible(true)}
                title="Rôle visible sur le lien de partage réal"
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60",
                  role.visible_partage
                    ? "border-turquoise bg-turquoise/15 text-turquoise"
                    : "border-border text-text-muted hover:text-text"
                )}
              >
                👁️ Visible
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => changeRoleVisible(false)}
                title="Rôle masqué du lien de partage réal"
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-60",
                  !role.visible_partage
                    ? "border-danger bg-danger/15 text-danger"
                    : "border-border text-text-muted hover:text-text"
                )}
              >
                🙈 Invisible
              </button>
            </div>
            <Badge tone={role.mode === "presentiel" ? "coral" : "default"}>
              {role.mode === "presentiel" ? "📅 " : "🎥 "}
              {CASTING_MODE_LABELS[role.mode]}
            </Badge>
            <Badge tone="turquoise">{submitted} envoyé{submitted > 1 ? "s" : ""}</Badge>
            <Badge tone="yellow">{entries.length - submitted} en attente</Badge>
            {deadlinePassed && <Badge tone="danger">Envoi clos</Badge>}
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

      {entries.length > 0 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded-full border border-coral/60 bg-coral/10 px-2 py-0.5 text-[11px] font-medium text-coral transition-colors hover:bg-coral/20"
          >
            {allSelected ? "Tout désélectionner" : `Tout sélectionner (${entries.length})`}
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">Profils du rôle sur le lien réal :</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => changeAllEntriesVisible(true)}
            className="rounded-full border border-turquoise/60 bg-turquoise/10 px-2 py-0.5 text-[11px] font-medium text-turquoise transition-colors hover:bg-turquoise/20 disabled:opacity-60"
          >
            👁️ Tous visibles
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => changeAllEntriesVisible(false)}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-text-muted transition-colors hover:text-text disabled:opacity-60"
          >
            🙈 Tous invisibles
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {entries.map((entry, i) => (
          <CastingEntryManageCard
            key={entry.id}
            entry={entry}
            portraitUrl={portraitByFigurant.get(entry.figurant_id) ?? null}
            videoUrls={videoUrlsByEntry.get(entry.id) ?? []}
            photoLabels={role.photo_labels}
            photos={entryPhotosByEntry.get(entry.id) ?? []}
            selected={selected.has(entry.id)}
            onToggleSelect={() => toggleSelect(entry.id)}
            previewItems={previewItems}
            previewIndex={i}
            showAgent={role.categorie_cachet === "role"}
            dateLimiteEnvoi={role.date_limite_envoi}
          />
        ))}
        {entries.length === 0 && <p className="text-sm text-text-muted">Aucun profil dans ce rôle pour l&apos;instant.</p>}
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
          {presentielJournees.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-ink px-3 py-2">
              <span className="text-xs font-medium text-text-muted">→ Planning présentiel :</span>
              <Select
                value={presentielJourneeId}
                onChange={(e) => {
                  setPresentielJourneeId(e.target.value);
                  setPresentielCreneauId("");
                }}
                className="w-40 text-xs"
              >
                <option value="">Journée...</option>
                {presentielJournees.map((j) => (
                  <option key={j.id} value={j.id}>
                    {formatDateShort(j.date)}
                  </option>
                ))}
              </Select>
              <Select
                value={presentielCreneauId}
                onChange={(e) => setPresentielCreneauId(e.target.value)}
                disabled={!selectedJournee || selectedJournee.creneaux.length === 0}
                className="w-64 text-xs"
              >
                <option value="">Créneau (aucun)</option>
                {selectedJournee?.creneaux.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.heure_debut.slice(0, 5)}–{c.heure_fin.slice(0, 5)} ({c.occupants.length}/{c.capacite})
                    {c.occupants.length > 0 ? ` — ${c.occupants.join(", ")}` : ""}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" disabled={pending || !presentielJourneeId} onClick={sendToPresentiel}>
                Envoyer
              </Button>
              {presentielResult && <span className="text-xs text-turquoise">{presentielResult}</span>}
              {presentielError && <span className="text-xs text-danger">{presentielError}</span>}
            </div>
          )}
          {sendError && <p className="text-sm text-danger">{sendError}</p>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              Message pour {selected.size} sélectionné·e{selected.size > 1 ? "s" : ""}
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
              onClick={applyPresentielTemplate}
              className="rounded-full border border-coral/60 bg-coral/10 px-3 py-1 text-xs font-medium text-coral hover:bg-coral/20"
            >
              Convocation présentiel
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
          {role.pdf_filename && (
            <p className="text-xs text-text-muted">📎 {role.pdf_filename} sera joint automatiquement.</p>
          )}
          <div className="flex flex-col gap-2">
            {entries
              .filter((e) => selected.has(e.id))
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {e.figurants?.prenom} {e.figurants?.nom}
                    {!e.figurants?.email && <span className="ml-2 text-xs text-text-muted">Pas d&apos;email</span>}
                    {e.figurants?.agent_email && (
                      <span className="ml-2 text-xs text-text-muted">— agent en copie</span>
                    )}
                    {presentielAssignments.get(e.figurant_id) && (
                      <span className="ml-2 text-xs text-text-muted">
                        — {presentielAssignments.get(e.figurant_id)!.dateLabel}
                        {presentielAssignments.get(e.figurant_id)!.heureLabel
                          ? ` ${presentielAssignments.get(e.figurant_id)!.heureLabel}`
                          : ""}
                      </span>
                    )}
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
