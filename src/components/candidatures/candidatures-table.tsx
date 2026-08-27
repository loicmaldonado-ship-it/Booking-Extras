"use client";

import { Fragment, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { substituteTokens } from "@/lib/bookings/convocation";
import { CandidatureRow } from "@/components/candidatures/candidature-row";
import { OngletPicker, TONE_CLASSES } from "@/components/candidatures/onglet-picker";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";
import { AddToCastingBar } from "@/components/casting/add-to-casting-bar";
import { ZoomButton } from "@/components/ui/zoomable-image";
import { ContactIcons } from "@/components/ui/contact-icons";
import type { PhotoType } from "@/lib/figurants/types";
import { toGalleryPhotos, galleryIndexOfUrl } from "@/lib/figurants/photo-labels";
import { recordCandidatureMessage, setCandidaturesOngletBulk } from "@/lib/candidatures/actions";
import type { Cachet, CandidatureOnglet } from "@/lib/candidatures/types";
import { projetNomPublic } from "@/lib/projets/types";
import { formatDateShort } from "@/lib/format-date";
import type { MessageTemplate } from "@/lib/templates/types";

export type Row = {
  id: string;
  onglet_id: string | null;
  fonction_assignee: string | null;
  cachet_assigne: Cachet | null;
  figurants: { id: string; prenom: string; nom: string; ville: string | null; email: string | null; telephone: string | null; compte_myrole: boolean } | null;
  annonces: {
    titre: string;
    projet_id: string;
    projets: { nom: string; confidentiel: boolean; nom_code: string | null; lieu: string | null; signature: string | null } | null;
  } | null;
  portraitUrl: string | null;
  photos?: { url: string | null; type: PhotoType }[];
};

export type CandidatureSummary = {
  questions: { label: string; reponse: boolean }[];
  dates: { date: string; disponible: boolean }[];
  message: string | null;
};

const DEFAULT_BODY = "Bonjour {prenom},\n\n";

function rowTokens(r: Row) {
  const projet = r.annonces?.projets;
  return {
    prenom: r.figurants?.prenom ?? "",
    projet: projetNomPublic(projet, "notre projet"),
    lieu: projet?.lieu ?? "",
    cachet: r.cachet_assigne ?? "",
    fonction: r.fonction_assignee ?? "",
    signature: projet?.signature ?? "",
  };
}

export function CandidaturesTable({
  rows,
  templates,
  projets,
  summaries = {},
  onglets,
}: {
  rows: Row[];
  templates: MessageTemplate[];
  projets: { id: string; nom: string }[];
  summaries?: Record<string, CandidatureSummary>;
  onglets: CandidatureOnglet[];
}) {
  const router = useRouter();
  const [, startStatutTransition] = useTransition();
  const [bulkOngletPending, startBulkOngletTransition] = useTransition();
  const [isTrombi, setIsTrombi] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkMessage, setBulkMessage] = useState(DEFAULT_BODY);
  const [sentBulk, setSentBulk] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);

  const selectableIds = rows.filter((r) => r.figurants?.id).map((r) => r.id);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === selectableIds.length ? new Set() : new Set(selectableIds)
    );
  }

  function openComposer(r: Row, template?: MessageTemplate) {
    setOpenRowId(r.id);
    const tokens = rowTokens(r);
    setSubject(template ? substituteTokens(template.sujet, tokens) : "Concernant votre candidature");
    setMessage(template ? substituteTokens(template.corps, tokens) : `Bonjour ${tokens.prenom},\n\n`);
  }

  function sendFree(r: Row) {
    if (!r.figurants?.email || !message.trim() || !r.figurants.id) return;
    setSendError(null);
    startStatutTransition(async () => {
      const result = await recordCandidatureMessage(
        r.figurants!.id,
        message,
        r.figurants!.email,
        subject,
        r.annonces?.projet_id
      );
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
    });
    setOpenRowId(null);
    setMessage("");
  }

  function applyBulkTemplate(template?: MessageTemplate) {
    setBulkSubject(template ? template.sujet : "Concernant votre candidature");
    setBulkMessage(template ? template.corps : DEFAULT_BODY);
  }

  function sendBulkTo(r: Row) {
    if (!r.figurants?.email || !bulkMessage.trim() || !r.figurants.id) return;
    const tokens = rowTokens(r);
    const body = substituteTokens(bulkMessage, tokens);
    const subj = substituteTokens(bulkSubject, tokens);
    setSendError(null);
    startStatutTransition(async () => {
      const result = await recordCandidatureMessage(
        r.figurants!.id,
        body,
        r.figurants!.email,
        subj,
        r.annonces?.projet_id
      );
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
    });
    setSentBulk((prev) => new Set([...prev, r.id]));
  }

  function sendBulkToAll() {
    const targets = rows.filter((r) => selected.has(r.id) && r.figurants?.email && r.figurants.id && !sentBulk.has(r.id));
    for (const r of targets) sendBulkTo(r);
  }

  function bulkSetOnglet(ongletId: string | null) {
    const ids = Array.from(selected);
    startBulkOngletTransition(async () => {
      await setCandidaturesOngletBulk(ids, ongletId);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {sendError && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{sendError}</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Vue :</span>
        <button
          type="button"
          onClick={() => setIsTrombi(false)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          Liste
        </button>
        <button
          type="button"
          onClick={() => setIsTrombi(true)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          Trombinoscope
        </button>
        {selectableIds.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="ml-auto rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
          >
            {selected.size === selectableIds.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-ink-raised px-4 py-3">
          <span className="text-sm font-medium">
            Changer le statut de {selected.size} profil{selected.size > 1 ? "s" : ""} :
          </span>
          <button
            type="button"
            disabled={bulkOngletPending}
            onClick={() => bulkSetOnglet(null)}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:text-text"
          >
            À trier
          </button>
          {onglets.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={bulkOngletPending}
              onClick={() => bulkSetOnglet(o.id)}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", TONE_CLASSES[o.couleur])}
            >
              {o.nom}
            </button>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-col gap-3">
          <Button type="button" variant="secondary" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "Masquer l'aperçu trombis" : "Prévisualiser en trombis"}
          </Button>

          {showPreview && (() => {
            const previewRows = rows.filter((r) => selected.has(r.id));

            return (
              <Card className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-text-muted">
                  Aperçu — {selected.size} profil{selected.size > 1 ? "s" : ""} avant ajout à la journée
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {previewRows.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-ink-raised p-3 text-center"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
                        {r.portraitUrl && (() => {
                          const gallery = toGalleryPhotos(r.photos);
                          return (
                            <>
                              <Image src={r.portraitUrl!} alt="" fill className="object-cover" unoptimized />
                              <ZoomButton
                                src={r.portraitUrl!}
                                gallery={gallery}
                                index={galleryIndexOfUrl(gallery, r.portraitUrl)}
                              />
                            </>
                          );
                        })()}
                      </div>
                      <div className="text-sm font-medium">
                        {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}

          <AddToJourneeBar
            figurantIds={rows
              .filter((r) => selected.has(r.id) && r.figurants?.id)
              .map((r) => r.figurants!.id)}
            candidatureIdByFigurant={Object.fromEntries(
              rows.filter((r) => selected.has(r.id) && r.figurants?.id).map((r) => [r.figurants!.id, r.id])
            )}
            projets={projets}
            onDone={() => setSelected(new Set())}
          />
          <AddToCastingBar
            figurantIds={rows
              .filter((r) => selected.has(r.id) && r.figurants?.id)
              .map((r) => r.figurants!.id)}
            projets={projets}
            onDone={() => setSelected(new Set())}
          />
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              Message pour {selected.size} sélectionné·e{selected.size > 1 ? "s" : ""}
            </span>
            <Button type="button" variant="secondary" disabled={!bulkMessage.trim()} onClick={sendBulkToAll}>
              Envoyer à tous
            </Button>
          </div>
          {templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-muted">Modèle :</span>
              <button
                type="button"
                onClick={() => applyBulkTemplate()}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:text-text"
              >
                Vierge
              </button>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyBulkTemplate(t)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
                >
                  {t.nom}
                </button>
              ))}
            </div>
          )}
          <Input value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)} placeholder="Sujet" />
          <textarea
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
          />
          <div className="flex flex-col gap-2">
            {rows
              .filter((r) => selected.has(r.id))
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                    {!r.figurants?.email && <span className="ml-2 text-xs text-text-muted">Pas d&apos;email</span>}
                  </span>
                  <Button
                    type="button"
                    variant={sentBulk.has(r.id) ? "ghost" : "secondary"}
                    disabled={!r.figurants?.email || !bulkMessage.trim()}
                    onClick={() => sendBulkTo(r)}
                  >
                    {sentBulk.has(r.id) ? "Envoyé" : `Envoyer à ${r.figurants?.prenom ?? ""}`}
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

      {isTrombi ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {rows.map((r) => (
            <div
              key={r.id}
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                selected.has(r.id) ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
              )}
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                disabled={!r.figurants?.id}
                onChange={() => toggle(r.id)}
                className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-border accent-coral"
              />
              <div className="group relative aspect-square w-full [perspective:1000px]">
                <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                  <Link
                    href={`/candidatures/${r.id}`}
                    className="absolute inset-0 overflow-hidden rounded-lg bg-ink-raised-2 [backface-visibility:hidden]"
                  >
                    {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
                  </Link>
                  <div className="absolute inset-0 flex flex-col gap-1 overflow-hidden rounded-lg bg-ink-raised-2 p-2 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    {(() => {
                      const summary = summaries[r.id];
                      if (!summary || (summary.questions.length === 0 && summary.dates.length === 0 && !summary.message)) {
                        return <p className="text-[10px] text-text-muted">Pas de détails.</p>;
                      }
                      return (
                        <div className="flex flex-1 flex-col gap-1 overflow-hidden text-[9px] leading-tight">
                          {summary.message && (
                            <p className="line-clamp-3 italic text-text-muted">&laquo; {summary.message} &raquo;</p>
                          )}
                          {summary.dates.map((d, i) => (
                            <div key={i} className="flex items-center justify-between gap-1">
                              <span className="truncate text-text-muted">{formatDateShort(d.date)}</span>
                              <span className={d.disponible ? "text-turquoise" : "text-danger"}>
                                {d.disponible ? "Dispo" : "Non"}
                              </span>
                            </div>
                          ))}
                          {summary.questions.map((q, i) => (
                            <div key={i} className="flex items-center justify-between gap-1">
                              <span className="truncate text-text-muted">{q.label}</span>
                              <span className={q.reponse ? "text-turquoise" : "text-danger"}>
                                {q.reponse ? "Oui" : "Non"}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <Link
                      href={`/candidatures/${r.id}`}
                      className="mt-auto text-[10px] font-medium text-coral hover:underline"
                    >
                      Vue complète →
                    </Link>
                  </div>
                </div>
              </div>
              <Link href={`/candidatures/${r.id}`} className="flex w-full flex-col items-center gap-1">
                <div className="text-sm font-medium">
                  {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                </div>
                <div className="text-xs text-text-muted">{r.annonces?.projets?.nom}</div>
              </Link>
              {r.portraitUrl && (() => {
                const gallery = toGalleryPhotos(r.photos);
                return (
                  <ZoomButton
                    src={r.portraitUrl!}
                    gallery={gallery}
                    index={galleryIndexOfUrl(gallery, r.portraitUrl)}
                    className="static flex items-center gap-1 rounded-full border border-border bg-transparent px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-coral/60 hover:text-text"
                  />
                );
              })()}
              <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} />
              <OngletPicker candidatureId={r.id} ongletId={r.onglet_id} onglets={onglets} />
            </div>
          ))}
          {rows.length === 0 && (
            <p className="col-span-full py-10 text-center text-text-muted">Aucune candidature pour l&apos;instant.</p>
          )}
        </div>
      ) : (
        <Card className="flex flex-col gap-3 p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectableIds.length > 0 && selected.size === selectableIds.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border accent-coral"
                  />
                </th>
                <th className="px-6 py-3 font-medium">Figurant</th>
                <th className="px-6 py-3 font-medium">Ville</th>
                <th className="px-6 py-3 font-medium">Myrole</th>
                <th className="px-6 py-3 font-medium">Annonce / Projet</th>
                <th className="px-6 py-3 font-medium">Onglet & fonction</th>
                <th className="px-6 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        disabled={!r.figurants?.id}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 rounded border-border accent-coral"
                      />
                    </td>
                    <td className="px-6 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Link href={`/candidatures/${r.id}`} className="hover:text-coral">
                          {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                        </Link>
                        <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} variant="inline" />
                      </div>
                    </td>
                    <td className="px-6 py-3 text-text-muted">{r.figurants?.ville ?? "—"}</td>
                    <td className="px-6 py-3">
                      {r.figurants?.compte_myrole ? <Badge tone="turquoise">Oui</Badge> : <Badge>Non</Badge>}
                    </td>
                    <td className="px-6 py-3 text-text-muted">
                      {r.annonces?.titre ?? "—"}
                      <br />
                      <span className="text-xs">{r.annonces?.projets?.nom}</span>
                    </td>
                    <td className="px-6 py-3">
                      <CandidatureRow
                        id={r.id}
                        ongletId={r.onglet_id}
                        onglets={onglets}
                        fonctionAssignee={r.fonction_assignee}
                        cachetAssigne={r.cachet_assigne}
                      />
                    </td>
                    <td className="px-6 py-3">
                      {r.figurants?.email ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => (openRowId === r.id ? setOpenRowId(null) : openComposer(r))}
                        >
                          Message
                        </Button>
                      ) : (
                        <span className="text-xs text-text-muted">Pas d&apos;email</span>
                      )}
                    </td>
                  </tr>
                  {openRowId === r.id && (
                    <tr className="border-b border-border last:border-0 bg-ink-raised-2/40">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {templates.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-text-muted">Modèle :</span>
                              <button
                                type="button"
                                onClick={() => openComposer(r)}
                                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:text-text"
                              >
                                Vierge
                              </button>
                              {templates.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => openComposer(r, t)}
                                  className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
                                >
                                  {t.nom}
                                </button>
                              ))}
                            </div>
                          )}
                          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Sujet" />
                          <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={5}
                            autoFocus
                            className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
                          />
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setOpenRowId(null)}>
                              Annuler
                            </Button>
                            <Button type="button" disabled={!message.trim()} onClick={() => sendFree(r)}>
                              Envoyer
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-text-muted">
                    Aucune candidature pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
