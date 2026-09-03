"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { StatusSelect } from "@/components/ui/status-select";
import { Button } from "@/components/ui/button";
import { ZoomButton } from "@/components/ui/zoomable-image";
import { ContactIcons } from "@/components/ui/contact-icons";
import { PreviewButton, type PreviewItem } from "@/components/figurants/figurant-preview-modal";
import { toGalleryPhotos, galleryIndexOfUrl } from "@/lib/figurants/photo-labels";
import { cn } from "@/lib/cn";
import {
  updateEssayageStatutInline,
  updateEssayageReponseRecue,
  removeEssayageFromJournee,
  recordEssayageMessage,
  uploadTenuePhoto,
  moveEssayagesToJournee,
  updateEssayageLieu,
} from "@/lib/essayages/actions";
import { ESSAYAGE_STATUTS, type EssayageStatut } from "@/lib/essayages/types";
import { buildEssayagePropositionMailto, buildEssayageConfirmationMailto } from "@/lib/essayages/messages";
import { formatDateShort } from "@/lib/format-date";
import type { Genre, PhotoType } from "@/lib/figurants/types";
import type { Creneau } from "./creneaux-panel";
import type { EssayageJournee } from "@/lib/essayages/journees";

const STATUT_TONE: Record<EssayageStatut, "yellow" | "coral" | "turquoise"> = {
  "proposé": "yellow",
  "confirmé": "coral",
  "fait": "turquoise",
};

export type EssayageRow = {
  id: string;
  statut: EssayageStatut;
  heure: string | null;
  notes: string | null;
  reponse_recue: boolean;
  creneau_id?: string | null;
  numero_costume?: string | null;
  figurant_id: string;
  lieu?: string | null;
  adresse?: string | null;
  figurants: { prenom: string; nom: string; telephone: string | null; email: string | null; genre?: Genre | null } | null;
  portraitUrl: string | null;
  photos?: { url: string | null; type: PhotoType }[];
};

export function EssayageJourneeTable({
  rows,
  projetId,
  projetNom,
  signature,
  journeeDate,
  journeeLieu,
  journeeAdresse = null,
  creneaux = [],
  autresJournees = [],
}: {
  rows: EssayageRow[];
  projetId?: string;
  projetNom: string;
  signature: string | null;
  journeeDate: string;
  journeeLieu: string | null;
  journeeAdresse?: string | null;
  creneaux?: Creneau[];
  autresJournees?: EssayageJournee[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Aperçu popup (bookings + échanges) — un item par figurant·e de cette
  // journée d'essayage, dans l'ordre affiché.
  const previewItems: PreviewItem[] = rows.map((r) => ({
    id: r.figurant_id,
    prenom: r.figurants?.prenom ?? "",
    nom: r.figurants?.nom ?? "",
    ville: null,
    portraitUrl: r.portraitUrl,
  }));

  const [consigne, setConsigne] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState("");
  const [moveLieu, setMoveLieu] = useState("");
  const [moveResult, setMoveResult] = useState<string | null>(null);
  const [lieuEditingId, setLieuEditingId] = useState<string | null>(null);
  const [lieuDraft, setLieuDraft] = useState("");
  const [adresseDraft, setAdresseDraft] = useState("");

  function openLieuEditor(r: EssayageRow) {
    setLieuEditingId(r.id);
    setLieuDraft(r.lieu ?? journeeLieu ?? "");
    setAdresseDraft(r.adresse ?? journeeAdresse ?? "");
  }

  function saveLieu(id: string) {
    startTransition(async () => {
      await updateEssayageLieu(id, lieuDraft.trim() || null, adresseDraft.trim() || null);
      setLieuEditingId(null);
      router.refresh();
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function moveSelected() {
    if (!projetId || !moveDate || selected.size === 0) return;
    setMoveResult(null);
    startTransition(async () => {
      const result = await moveEssayagesToJournee(Array.from(selected), projetId, moveDate, moveLieu.trim() || null);
      if (result.error) {
        setMoveResult(result.error);
        return;
      }
      setMoveResult(
        `${result.moved ?? 0} déplacé${(result.moved ?? 0) > 1 ? "s" : ""}${result.skipped ? `, ${result.skipped} déjà présent(s) sur cette date` : ""}.`
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  function heureFor(r: EssayageRow): string | null {
    const creneau = creneaux.find((c) => c.id === r.creneau_id);
    return creneau?.heure_debut ?? r.heure;
  }

  function setStatut(id: string, statut: EssayageStatut) {
    startTransition(async () => {
      await updateEssayageStatutInline(id, statut);
      router.refresh();
    });
  }

  function setReponseRecue(id: string, value: boolean) {
    startTransition(async () => {
      await updateEssayageReponseRecue(id, value);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeEssayageFromJournee(id);
      router.refresh();
    });
  }

  function uploadTenue(r: EssayageRow, file: File) {
    if (!projetId) return;
    const formData = new FormData();
    formData.set("photo", file);
    setSendError(null);
    startTransition(async () => {
      const result = await uploadTenuePhoto(r.figurant_id, projetId, formData);
      if (result?.error) setSendError(`Échec de l'envoi de la photo : ${result.error}`);
      router.refresh();
    });
  }

  function sendProposition(r: EssayageRow) {
    if (!r.figurants?.email) return;
    const { subject, body } = buildEssayagePropositionMailto({
      figurantPrenom: r.figurants.prenom,
      figurantEmail: r.figurants.email,
      date: journeeDate,
      heure: heureFor(r),
      lieu: r.lieu ?? journeeLieu,
      adresse: r.adresse ?? journeeAdresse,
      projetNom,
      signature,
    });
    setSendError(null);
    startTransition(async () => {
      const result = await recordEssayageMessage(r.figurant_id, body, r.figurants!.email, subject, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
    });
  }

  function sendConfirmation(r: EssayageRow) {
    if (!r.figurants?.email) return;
    const { subject, body } = buildEssayageConfirmationMailto({
      figurantPrenom: r.figurants.prenom,
      figurantEmail: r.figurants.email,
      date: journeeDate,
      heure: heureFor(r),
      lieu: r.lieu ?? journeeLieu,
      adresse: r.adresse ?? journeeAdresse,
      projetNom,
      signature,
      consigne,
      numeroCostume: r.numero_costume,
    });
    setSendError(null);
    startTransition(async () => {
      const result = await recordEssayageMessage(r.figurant_id, body, r.figurants!.email, subject, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
    });
  }

  if (rows.length === 0) {
    return <p className="py-10 text-center text-text-muted">Aucun profil pour cette journée d&apos;essayage.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sendError && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{sendError}</div>
      )}
      {selected.size > 0 && projetId && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <span className="text-sm">{selected.size} sélectionné·e{selected.size > 1 ? "s" : ""}</span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setMoveResult(null);
              setMoveOpen((v) => !v);
            }}
          >
            Déplacer vers une autre date
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>
            Désélectionner
          </Button>
          {moveOpen && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-coral/40 pt-3">
              <datalist id="autres-journees-essayage">
                {autresJournees.map((j) => (
                  <option key={j.id} value={j.date}>
                    {formatDateShort(j.date)} — {j.total} profil{j.total > 1 ? "s" : ""}
                  </option>
                ))}
              </datalist>
              <input
                type="date"
                list="autres-journees-essayage"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                disabled={pending}
                className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
              />
              <input
                value={moveLieu}
                onChange={(e) => setMoveLieu(e.target.value)}
                placeholder="Lieu (optionnel, si nouvelle date)"
                disabled={pending}
                className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
              />
              <Button type="button" variant="turquoise" disabled={pending || !moveDate} onClick={moveSelected}>
                {pending ? "Déplacement..." : "Déplacer"}
              </Button>
              {moveResult && <span className="text-xs text-text-muted">{moveResult}</span>}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-text-muted">
          Consigne à ajouter aux messages de confirmation (optionnel)
        </label>
        <input
          value={consigne}
          onChange={(e) => setConsigne(e.target.value)}
          placeholder="Ex : merci de venir avec les cheveux propres"
          className="w-full max-w-md rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none focus:border-coral"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-ink-raised p-3 text-center"
          >
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggleSelected(r.id)}
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
            <Link href={`/figurants/${r.figurant_id}`} className="flex w-full flex-col items-center gap-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
                {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" />}
                {r.portraitUrl && (() => {
                  const gallery = toGalleryPhotos(r.photos);
                  return <ZoomButton src={r.portraitUrl!} gallery={gallery} index={galleryIndexOfUrl(gallery, r.portraitUrl)} />;
                })()}
              </div>
              <div className="text-sm font-medium">
                {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
              </div>
              <div className="flex items-center gap-1 text-xs text-text-muted">
                {heureFor(r) && <span>{heureFor(r)!.slice(0, 5)}</span>}
                {r.numero_costume && <span className="text-coral">· {r.numero_costume}</span>}
              </div>
            </Link>
            <div className="flex items-center gap-1">
              <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} />
              <PreviewButton items={previewItems} index={i} />
            </div>
            <button
              type="button"
              onClick={() => (lieuEditingId === r.id ? setLieuEditingId(null) : openLieuEditor(r))}
              className="w-full truncate text-[10px] text-text-muted hover:text-coral hover:underline"
              title="Changer le lieu pour cette personne uniquement"
            >
              📍 {r.lieu ?? journeeLieu ?? "Lieu à définir"}
            </button>
            {lieuEditingId === r.id && (
              <div className="flex w-full flex-col gap-1.5 rounded-lg border border-coral/40 bg-ink p-2">
                <input
                  value={lieuDraft}
                  onChange={(e) => setLieuDraft(e.target.value)}
                  placeholder="Nom du lieu"
                  disabled={pending}
                  className="w-full rounded-md border border-border bg-ink-raised-2 px-2 py-1 text-xs outline-none focus:border-coral disabled:opacity-60"
                />
                <input
                  value={adresseDraft}
                  onChange={(e) => setAdresseDraft(e.target.value)}
                  placeholder="Adresse"
                  disabled={pending}
                  className="w-full rounded-md border border-border bg-ink-raised-2 px-2 py-1 text-xs outline-none focus:border-coral disabled:opacity-60"
                />
                <div className="flex justify-center gap-1.5">
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => setLieuEditingId(null)}>
                    Annuler
                  </Button>
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => saveLieu(r.id)}>
                    {pending ? "..." : "Enregistrer"}
                  </Button>
                </div>
              </div>
            )}
            {projetId && (
              <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text">
                📷 Photo en tenue
                <input
                  type="file"
                  accept="image/*"
                  disabled={pending}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadTenue(r, file);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <StatusSelect
              tone={STATUT_TONE[r.statut]}
              value={r.statut}
              disabled={pending}
              onChange={(e) => setStatut(r.id, e.target.value as EssayageStatut)}
              className="w-full"
            >
              {ESSAYAGE_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </StatusSelect>
            <label
              className={cn(
                "flex w-fit items-center gap-1.5 text-xs font-medium",
                r.reponse_recue ? "text-yellow" : "text-text-muted"
              )}
            >
              <input
                type="checkbox"
                checked={r.reponse_recue}
                disabled={pending}
                onChange={(e) => setReponseRecue(r.id, e.target.checked)}
                className="h-4 w-4 rounded border-border accent-yellow"
              />
              Répondu
            </label>
            {r.figurants?.email ? (
              <div className="flex w-full flex-col gap-1">
                <Button type="button" variant="ghost" onClick={() => sendProposition(r)}>
                  Proposition
                </Button>
                <Button
                  type="button"
                  variant={r.reponse_recue ? "secondary" : "ghost"}
                  onClick={() => sendConfirmation(r)}
                >
                  Confirmation
                </Button>
              </div>
            ) : (
              <span className="text-xs text-text-muted">Pas d&apos;email</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
