"use client";

import { nomComplet } from "@/lib/noms";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { ContactIcons } from "@/components/ui/contact-icons";
import { AgentNomInput } from "@/components/agents/agent-nom-input";
import { EntryNotesField } from "@/components/casting/entry-notes-field";
import { PreviewButton, type PreviewItem } from "@/components/figurants/figurant-preview-modal";
import { FigurantEditModal } from "@/components/figurants/figurant-edit-modal";
import { ACCEPT_IMAGES, prepareImage } from "@/lib/media/compress-image";
import { envoyerVideo, declencherAllegement, formatTaille, formatRestant, type Progression } from "@/lib/media/upload-video";
import { cn } from "@/lib/cn";
import { AVIS_LIBELLES, type AvisReel } from "@/lib/casting/avis";
import {
  deleteCastingEntry,
  deleteCastingPhoto,
  addCastingPhoto,
  removeCastingVideo,
  createStaffCastingVideoSlot,
  addCastingVideo,
  updateCastingVideoLabel,
  setCastingVideoPosition,
  updateCastingEntryStatut,
  updateCastingEntryMode,
  updateCastingEntryNotes,
  updateCastingEntryVisiblePartage,
  choisirVignetteCasting,
} from "@/lib/casting/actions";
import { Modale } from "@/components/ui/modale";
import type { PhotoVignette } from "@/lib/casting/vignette";
import { updateFigurantAgent } from "@/lib/figurants/actions";
import { StatusSelect } from "@/components/ui/status-select";
import { statutTone, type BookingStatut } from "@/lib/bookings/types";
import { CASTING_MODE_LABELS, CASTING_STATUTS, type CastingEntry, type CastingMode } from "@/lib/casting/types";
import type { CastingEntryPhoto } from "@/lib/casting/data";
import { formatDateLong } from "@/lib/format-date";

function PhotoUploadSlot({ entryId, label }: { entryId: string; label: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
      const prepare = await prepareImage(file);
      if ("error" in prepare) {
        setError(prepare.error);
        return;
      }
      const fd = new FormData();
      fd.set("photo", prepare.file);
      const result = await addCastingPhoto(entryId, label, fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        disabled={pending}
        className={cn(
          "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-text-muted transition-colors disabled:opacity-60",
          dragOver ? "border-coral bg-coral/10" : "border-border bg-ink-raised-2 hover:border-coral/60"
        )}
      >
        <span className="text-lg">+</span>
        {pending ? "Envoi..." : "Ajouter"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      <span className="text-center text-[11px] text-text-muted">{label}</span>
      {error && <span className="text-center text-[10px] text-danger">{error}</span>}
    </div>
  );
}

function ExistingPhoto({ photo, gallery, index }: { photo: CastingEntryPhoto; gallery: GalleryPhoto[]; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      await deleteCastingPhoto(photo.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
        <Image src={photo.url} alt={photo.label} fill sizes="33vw" className="object-cover" />
        <ZoomButton src={photo.url} alt={photo.label} gallery={gallery} index={index} />
        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-sm text-text hover:bg-danger hover:text-ink disabled:opacity-60"
          title="Retirer cette photo"
        >
          ×
        </button>
      </div>
      <span className="text-center text-[11px] text-text-muted">{photo.label}</span>
    </div>
  );
}

function VideoWithRemove({
  entryId,
  url,
  path,
  label,
  position,
}: {
  entryId: string;
  url: string;
  path: string;
  label: string;
  position: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renamePending, startRenameTransition] = useTransition();
  const [positionPending, startPositionTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      await removeCastingVideo(entryId, path);
      router.refresh();
    });
  }

  function rename(value: string) {
    if (value.trim() === label) return;
    startRenameTransition(async () => {
      await updateCastingVideoLabel(entryId, path, value);
      router.refresh();
    });
  }

  function changePosition(value: string) {
    const n = Number(value);
    if (!Number.isFinite(n) || n === position) return;
    startPositionTransition(async () => {
      await setCastingVideoPosition(entryId, path, n);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          key={position}
          type="number"
          min={1}
          disabled={positionPending}
          defaultValue={position}
          onBlur={(e) => changePosition(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          title="N° d'ordre — change ce chiffre pour déplacer la vidéo"
          className="w-10 shrink-0 rounded-lg border border-border bg-ink px-1 py-1 text-center text-xs font-semibold outline-none focus:border-coral disabled:opacity-50"
        />
        <input
          key={label}
          defaultValue={label}
          disabled={renamePending}
          onBlur={(e) => rename(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Nom de la vidéo"
          className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-text outline-none hover:border-border focus:border-coral focus:bg-ink-raised-2 disabled:opacity-60"
        />
      </div>
      <video controls preload="metadata" className="w-full rounded-lg bg-black">
        <source src={url} />
      </video>
      <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
        Retirer cette vidéo
      </Button>
    </div>
  );
}

type EnvoiVideo = {
  id: string;
  file: File;
  label: string;
  statut: "attente" | "envoi" | "ok" | "erreur";
  progression: Progression | null;
  erreur: string | null;
};

// Choisir ou glisser une ou plusieurs vidéos : elles partent tout de suite,
// telles quelles, l'une après l'autre (dans l'ordre choisi, toute la
// connexion pour la vidéo en cours), avec sa barre de progression, et
// s'ajoutent au profil toutes seules en arrivant. Le nom, c'est celui du
// fichier : il se change ensuite sur la vidéo.
const ENVOIS_SIMULTANES = 1;

function AddVideoButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [envois, setEnvois] = useState<EnvoiVideo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // Envois en cours (pour les annuler) et file d'attente, lus en direct : le
  // state React arrive trop tard pour décider qui part.
  const controllers = useRef(new Map<string, AbortController>());
  const file = useRef<EnvoiVideo[]>([]);

  function maj(id: string, patch: Partial<EnvoiVideo>) {
    setEnvois((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function lancer(item: EnvoiVideo) {
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    maj(item.id, { statut: "envoi", erreur: null, progression: { pct: 0, restant: null, essai: 1 } });
    try {
      const path = await envoyerVideo({
        file: item.file,
        signal: controller.signal,
        onProgress: (progression) => maj(item.id, { progression }),
        createSlot: () => createStaffCastingVideoSlot(entryId),
        logContext: { source: "equipe", entryId },
      });
      const res = await addCastingVideo(entryId, path, item.label);
      if (res?.error) throw new Error(res.error);
      declencherAllegement(path);
      maj(item.id, { statut: "ok", progression: { pct: 100, restant: 0, essai: 1 } });
      router.refresh();
      setTimeout(() => setEnvois((l) => l.filter((e) => e.id !== item.id)), 2500);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setEnvois((l) => l.filter((x) => x.id !== item.id));
      } else {
        maj(item.id, { statut: "erreur", erreur: e instanceof Error ? e.message : "Échec de l'envoi." });
      }
    } finally {
      controllers.current.delete(item.id);
      demarrerSuivants();
    }
  }

  // Lance les envois en attente tant qu'il reste de la place.
  function demarrerSuivants() {
    while (controllers.current.size < ENVOIS_SIMULTANES && file.current.length > 0) {
      lancer(file.current.shift()!);
    }
  }

  function ajouter(files: File[]) {
    const videos = files.filter((f) => f.type.startsWith("video/") || /\.(mov|mp4|m4v|webm|avi|mkv)$/i.test(f.name));
    if (videos.length === 0) return;
    const nouveaux: EnvoiVideo[] = videos.map((fichier) => ({
      id: crypto.randomUUID(),
      file: fichier,
      label: fichier.name.replace(/\.\w+$/, ""),
      statut: "attente",
      progression: null,
      erreur: null,
    }));
    setEnvois((l) => [...l, ...nouveaux]);
    file.current.push(...nouveaux);
    demarrerSuivants();
  }

  function annuler(id: string) {
    const controller = controllers.current.get(id);
    if (controller) controller.abort();
    else {
      file.current = file.current.filter((e) => e.id !== id);
      setEnvois((l) => l.filter((e) => e.id !== id));
    }
  }

  function reessayer(item: EnvoiVideo) {
    maj(item.id, { statut: "attente", erreur: null, progression: null });
    file.current.push({ ...item, statut: "attente" });
    demarrerSuivants();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          ajouter(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn("rounded-xl border-2 border-dashed p-1.5 transition-colors", dragOver ? "border-coral bg-coral/10" : "border-border-strong")}
      >
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} className="w-full">
          ＋ Ajouter des vidéos
        </Button>
        <p className="mt-1 text-center text-[11px] text-text-muted">ou glisse-les ici · elles partent tout de suite</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          ajouter(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {envois.map((e) => (
        <div key={e.id} className="flex flex-col gap-1 rounded-lg border border-border bg-ink-raised-2 px-2 py-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium" title={e.file.name}>
              {e.label}
            </span>
            {e.statut !== "ok" && (
              <button
                type="button"
                onClick={() => annuler(e.id)}
                className="shrink-0 rounded-full border border-border-strong px-2 py-0.5 font-medium hover:border-text"
              >
                {e.statut === "erreur" ? "Retirer" : "Annuler"}
              </button>
            )}
          </div>
          {e.statut === "ok" ? (
            <span className="font-medium text-turquoise">✓ Ajoutée</span>
          ) : e.statut === "erreur" ? (
            <>
              <span className="text-danger">{e.erreur}</span>
              <button
                type="button"
                onClick={() => reessayer(e)}
                className="self-start rounded-full border border-text px-2.5 py-0.5 font-semibold text-coral"
              >
                Réessayer
              </button>
            </>
          ) : (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-raised">
                <div
                  className="h-full rounded-full bg-turquoise transition-[width]"
                  style={{ width: `${e.statut === "envoi" ? (e.progression?.pct ?? 0) : 0}%` }}
                />
              </div>
              <span className="tabular-nums text-text-muted">
                {e.statut === "attente"
                  ? `En attente · ${formatTaille(e.file.size)}`
                  : `${e.progression?.pct ?? 0} %${
                      e.progression?.restant != null && e.progression.restant > 1 ? ` · ${formatRestant(e.progression.restant)}` : ""
                    } · ${formatTaille(e.file.size)}${(e.progression?.essai ?? 1) > 1 ? ` · nouvel essai ${e.progression?.essai}` : ""}`}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Choix de la photo montrée sur la vignette (Casting, lien réal, trombis et
// documents du casting) parmi les photos du profil et celles envoyées pour
// ce rôle.
function ChoixVignette({
  entryId,
  photos,
  choisieId,
  onClose,
}: {
  entryId: string;
  photos: PhotoVignette[];
  choisieId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const choisie = photos.some((p) => p.id === choisieId) ? choisieId : null;

  function choisir(photoId: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await choisirVignetteCasting(entryId, photoId);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modale
      titre="🖼️ Photo de la vignette"
      sousTitre="Celle qui apparaît dans Casting, sur le lien réal, les trombis et les documents du casting."
      onClose={onClose}
      bloquee={pending}
    >
      {photos.length === 0 ? (
        <p className="text-sm text-text-muted">Aucune photo sur ce profil pour l&apos;instant.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => choisir(p.id)}
              className="flex flex-col gap-1 text-left disabled:opacity-60"
            >
              <div
                className={cn(
                  "relative aspect-square w-full overflow-hidden rounded-lg border-2 bg-ink-raised-2",
                  choisie === p.id ? "border-coral" : "border-transparent hover:border-coral/50"
                )}
              >
                <Image src={p.url} alt={p.label} fill sizes="150px" className="object-cover" />
                {choisie === p.id && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-coral text-xs text-ink">
                    ✓
                  </span>
                )}
              </div>
              <span className="text-center text-[11px] text-text-muted">{p.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          {choisie ? "Photo choisie à la main." : "Automatique : essayage du projet, sinon portrait."}
        </span>
        {choisie && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => choisir(null)}>
            Revenir à l&apos;automatique
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modale>
  );
}

const AGENT_INPUT_CLASS =
  "w-full rounded-lg border border-border bg-ink-raised-2 px-2 py-1 text-xs outline-none focus:border-coral";

// N'a de sens que pour les rôles (categorie_cachet = "role") : les
// figurant·es de figuration n'ont généralement pas d'agent, contrairement
// aux comédien·nes qui tiennent un rôle nommé. L'agent est rattaché à la
// fiche du·de la comédien·ne (pas à cette entrée de casting précise) — le
// modifier ici le met à jour partout où ce profil apparaît.
function AgentSection({
  figurantId,
  agentNom,
  agentEmail,
  agentTelephone,
  agentAgence,
}: {
  figurantId: string;
  agentNom: string | null;
  agentEmail: string | null;
  agentTelephone: string | null;
  agentAgence: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nom, setNom] = useState(agentNom ?? "");
  const [email, setEmail] = useState(agentEmail ?? "");
  const [telephone, setTelephone] = useState(agentTelephone ?? "");
  const [agence, setAgence] = useState(agentAgence ?? "");
  const [error, setError] = useState<string | null>(null);

  const hasAgent = !!(agentNom || agentEmail || agentTelephone || agentAgence);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("agent_nom", nom);
    fd.set("agent_email", email);
    fd.set("agent_telephone", telephone);
    fd.set("agent_agence", agence);
    startTransition(async () => {
      const result = await updateFigurantAgent(figurantId, fd);
      if (result?.error) setError(result.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-coral/40 bg-ink px-2.5 py-2">
        <AgentNomInput
          value={nom}
          onChange={setNom}
          onSelect={(a) => {
            setNom(a.nom);
            setAgence(a.agence ?? "");
            setEmail(a.email ?? "");
            setTelephone(a.telephone ?? "");
          }}
          placeholder="Nom de l'agent"
          className={AGENT_INPUT_CLASS}
        />
        <input value={agence} onChange={(e) => setAgence(e.target.value)} placeholder="Agence" className={AGENT_INPUT_CLASS} />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email de l'agent"
          type="email"
          className={AGENT_INPUT_CLASS}
        />
        <input
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="Téléphone de l'agent"
          className={AGENT_INPUT_CLASS}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-text hover:text-text">
            Annuler
          </button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    );
  }

  if (!hasAgent) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-fit rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs text-text hover:border-coral/60 hover:text-text"
      >
        + Ajouter un agent
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-ink px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">
          🎭 Agent : {agentNom || "—"}
          {agentAgence ? ` (${agentAgence})` : ""}
        </span>
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-coral hover:underline">
          Modifier
        </button>
      </div>
      <ContactIcons telephone={agentTelephone} email={agentEmail} variant="inline" />
    </div>
  );
}

export function CastingEntryManageCard({
  entry,
  portraitUrl,
  photosVignette = [],
  videoUrls,
  photoLabels,
  photos,
  selected,
  onToggleSelect,
  previewItems,
  previewIndex,
  showAgent,
  dateLimiteEnvoi,
  avisReel = [],
  commentairesReel = 0,
}: {
  entry: CastingEntry;
  portraitUrl: string | null;
  photosVignette?: PhotoVignette[];
  videoUrls: { url: string; path: string; label: string }[];
  photoLabels: string[];
  photos: CastingEntryPhoto[];
  selected?: boolean;
  onToggleSelect?: () => void;
  previewItems?: PreviewItem[];
  previewIndex?: number;
  showAgent?: boolean;
  dateLimiteEnvoi?: string | null;
  // Ce que les réal ont répondu sur le lien réal.
  avisReel?: AvisReel[];
  commentairesReel?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [vignetteOpen, setVignetteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [statutPending, startStatutTransition] = useTransition();
  const [modePending, startModeTransition] = useTransition();
  const [visiblePending, startVisibleTransition] = useTransition();
  const todayIso = new Date().toISOString().slice(0, 10);

  function removeEntry() {
    startTransition(async () => {
      await deleteCastingEntry(entry.id);
      router.refresh();
    });
  }

  function changeStatut(statut: BookingStatut) {
    startStatutTransition(async () => {
      await updateCastingEntryStatut(entry.id, statut);
      router.refresh();
    });
  }

  function changeMode(mode: CastingMode) {
    if (mode === entry.mode) return;
    startModeTransition(async () => {
      await updateCastingEntryMode(entry.id, mode);
      router.refresh();
    });
  }

  function changeVisible(visible: boolean) {
    if (visible === entry.visible_partage) return;
    startVisibleTransition(async () => {
      await updateCastingEntryVisiblePartage(entry.id, visible);
      router.refresh();
    });
  }

  const gallery: GalleryPhoto[] = photos.map((p) => ({ src: p.url, alt: p.label }));
  const photoByLabel = new Map(photos.map((p) => [p.label, p]));
  const extraPhotos = photos.filter((p) => !photoLabels.includes(p.label));

  return (
    <div className="relative flex w-full max-w-xs flex-col gap-2 rounded-xl border border-border bg-ink-raised p-3">
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          className="absolute left-4 top-4 z-10 h-4 w-4 rounded border-border accent-coral"
        />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 text-left"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
          {portraitUrl && <Image src={portraitUrl} alt="" fill sizes="64px" className="object-cover" />}
          {entry.statut === "valide" && (
            <span
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-turquoise text-xs text-ink"
              title="Validé"
            >
              ✓
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium">
            {nomComplet(entry.figurants)}
          </span>
        </div>
        <span className="text-text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {(avisReel.length > 0 || commentairesReel > 0) && (
        <div className="flex flex-wrap gap-1.5" aria-label="Retour du·de la réal">
          {avisReel.map((a) => (
            <span
              key={`${a.nom}-${a.role}`}
              title={`${a.nom}${a.role ? ` (${a.role})` : ""} : ${AVIS_LIBELLES[a.avis]}`}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold text-white",
                a.avis === "oui" ? "bg-turquoise" : a.avis === "non" ? "bg-danger" : "bg-yellow"
              )}
            >
              {a.avis === "oui" ? "✓" : a.avis === "non" ? "✕" : "?"} {a.nom}
            </span>
          ))}
          {commentairesReel > 0 && (
            <span className="rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium" title="Voir dans le fil du lien réal (💬)">
              💬 {commentairesReel}
            </span>
          )}
        </div>
      )}
      {dateLimiteEnvoi && !entry.submitted_at && (
        <p className={cn("text-xs", dateLimiteEnvoi < todayIso ? "font-medium text-danger" : "text-text-muted")}>
          {dateLimiteEnvoi < todayIso ? "Envoi clos depuis le " : "Envoi avant le "}
          {formatDateLong(dateLimiteEnvoi)}
        </p>
      )}
      <div className="flex gap-1.5">
        {(Object.keys(CASTING_MODE_LABELS) as CastingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={modePending}
            onClick={() => changeMode(m)}
            className={cn(
              "flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
              entry.mode === m
                ? m === "presentiel"
                  ? "border-coral bg-coral/15 text-coral"
                  : "border-turquoise bg-turquoise/15 text-turquoise"
                : "border-border-strong text-text hover:text-text"
            )}
          >
            {m === "presentiel" ? "📅 " : "🎥 "}
            {CASTING_MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={visiblePending}
          onClick={() => changeVisible(true)}
          title="Visible sur le lien de partage réal"
          className={cn(
            "flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
            entry.visible_partage ? "border-turquoise bg-turquoise/15 text-turquoise" : "border-border-strong text-text hover:text-text"
          )}
        >
          👁️ Visible
        </button>
        <button
          type="button"
          disabled={visiblePending}
          onClick={() => changeVisible(false)}
          title="Masqué du lien de partage réal"
          className={cn(
            "flex-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
            !entry.visible_partage ? "border-danger bg-danger/15 text-danger" : "border-border-strong text-text hover:text-text"
          )}
        >
          🙈 Invisible
        </button>
      </div>
      <StatusSelect
        value={entry.statut}
        tone={statutTone(entry.statut)}
        disabled={statutPending}
        onChange={(e) => changeStatut(e.target.value as BookingStatut)}
      >
        {CASTING_STATUTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </StatusSelect>
      <div className="flex items-center gap-1">
        <ContactIcons telephone={entry.figurants?.telephone} email={entry.figurants?.email} variant="inline" />
        {previewItems && previewIndex !== undefined && <PreviewButton items={previewItems} index={previewIndex} />}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          title="Modifier la fiche du profil"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-ink text-xs text-text hover:border-coral/60 hover:text-text"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={() => setVignetteOpen(true)}
          title="Choisir la photo de la vignette"
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-ink text-xs text-text hover:border-coral/60 hover:text-text"
        >
          🖼️
        </button>
        {editOpen && <FigurantEditModal figurantId={entry.figurant_id} onClose={() => setEditOpen(false)} />}
        {vignetteOpen && (
          <ChoixVignette
            entryId={entry.id}
            photos={photosVignette}
            choisieId={entry.photo_vignette_id}
            onClose={() => setVignetteOpen(false)}
          />
        )}
      </div>
      {showAgent && (
        <AgentSection
          figurantId={entry.figurant_id}
          agentNom={entry.figurants?.agent_nom ?? null}
          agentEmail={entry.figurants?.agent_email ?? null}
          agentTelephone={entry.figurants?.agent_telephone ?? null}
          agentAgence={entry.figurants?.agent_agence ?? null}
        />
      )}

      {open && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {videoUrls.map((v, i) => (
            <VideoWithRemove key={v.path} entryId={entry.id} url={v.url} path={v.path} label={v.label} position={i + 1} />
          ))}
          <AddVideoButton entryId={entry.id} />

          {photoLabels.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoLabels.map((label) => {
                const photo = photoByLabel.get(label);
                return photo ? (
                  <ExistingPhoto
                    key={label}
                    photo={photo}
                    gallery={gallery}
                    index={gallery.findIndex((g) => g.src === photo.url)}
                  />
                ) : (
                  <PhotoUploadSlot key={label} entryId={entry.id} label={label} />
                );
              })}
              {extraPhotos.map((photo) => (
                <ExistingPhoto
                  key={photo.id}
                  photo={photo}
                  gallery={gallery}
                  index={gallery.findIndex((g) => g.src === photo.url)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {entry.booking_id && (
        <Link
          href={`/bookings/${entry.booking_id}`}
          className="text-center text-xs font-medium text-coral hover:underline"
        >
          → Voir le booking
        </Link>
      )}

      {(entry.reponses ?? []).length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-ink px-2 py-1.5 text-xs">
          {entry.reponses.map((r) => (
            <p key={r.question}>
              {r.question}{" "}
              <strong className={r.reponse === "oui" ? "text-turquoise" : "text-danger"}>
                {r.reponse === "oui" ? "Oui" : "Non"}
              </strong>
              {r.precision ? <span className="text-text-muted"> — {r.precision}</span> : null}
            </p>
          ))}
        </div>
      )}

      <EntryNotesField initialValue={entry.notes} onSave={(notes) => updateCastingEntryNotes(entry.id, notes)} />

      <Button type="button" variant="ghost" disabled={pending} onClick={removeEntry}>
        Retirer du rôle
      </Button>
    </div>
  );
}
