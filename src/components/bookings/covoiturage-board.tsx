"use client";

import { useMemo, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { bulkUpdateBookings, copyCovoiturageToDate, recordCovoiturageMessage } from "@/lib/bookings/actions";
import { formatDateShort } from "@/lib/format-date";
import {
  buildChauffeurMessage,
  buildPassagerMessage,
  montantCovoiturage,
  contactHref,
  openHref,
  smsConversationHref,
} from "@/lib/bookings/covoiturage-messages";
import { cn } from "@/lib/cn";
import { COVOITURAGE_ROLES, type CovoiturageRole } from "@/lib/bookings/types";

export type CovoiturageRow = {
  id: string;
  figurant_id: string;
  covoiturage_role: CovoiturageRole | null;
  covoiturage_lieu_depart: string | null;
  covoiturage_places_disponibles: number | null;
  covoiturage_conducteur_id: string | null;
  figurants: {
    prenom: string;
    nom: string;
    telephone: string | null;
    email: string | null;
    ville: string | null;
    code_postal: string | null;
  } | null;
  portraitUrl: string | null;
};

const fieldClass =
  "w-full rounded-lg border border-border bg-ink px-2 py-1.5 text-xs outline-none focus:border-coral disabled:opacity-60";

function lieuLabel(r: CovoiturageRow) {
  const { ville, code_postal } = r.figurants ?? {};
  if (ville && code_postal) return `${ville} (${code_postal})`;
  return ville || code_postal || null;
}

// Trié par nom de famille (pas prénom+nom) — c'est ce qui permet de repérer
// d'un coup d'œil qui habite dans le même coin quand on regarde le groupe
// "Sans covoiturage" pour organiser les trajets à la main.
function sortByNomFamille(rows: CovoiturageRow[]) {
  return [...rows].sort(
    (a, b) =>
      (a.figurants?.nom ?? "").localeCompare(b.figurants?.nom ?? "") ||
      (a.figurants?.prenom ?? "").localeCompare(b.figurants?.prenom ?? "")
  );
}

// Regroupe par code postal croissant (non renseigné en dernier), chaque
// groupe trié par nom de famille — voir sortByNomFamille.
function groupByCodePostal(rows: CovoiturageRow[]): { codePostal: string; rows: CovoiturageRow[] }[] {
  const map = new Map<string, CovoiturageRow[]>();
  for (const r of rows) {
    const key = r.figurants?.code_postal ?? "";
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    })
    .map(([codePostal, groupRows]) => ({ codePostal, rows: sortByNomFamille(groupRows) }));
}

export function CovoiturageBoard({
  rows,
  date,
  projetId,
  tarifBase = 15,
  tarifPassager = 5,
  autresDates = [],
}: {
  rows: CovoiturageRow[];
  date: string;
  projetId?: string;
  tarifBase?: number;
  tarifPassager?: number;
  autresDates?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<"trombi" | "liste">("trombi");
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);
  // Sélection multiple (cases à cocher sur les cartes) — glisser une carte
  // cochée déplace tout le lot en un seul aller-retour serveur, plutôt que
  // de forcer un glisser-déposer profil par profil.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelected(figurantId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(figurantId)) next.delete(figurantId);
      else next.add(figurantId);
      return next;
    });
  }

  // Copie l'organisation covoiturage de cette journée vers une autre date
  // du même projet (utile quand les mêmes personnes sont raccord).
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyDate, setCopyDate] = useState(autresDates[0] ?? "");
  const [copyResult, setCopyResult] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  function applyCopy() {
    if (!copyDate || !projetId) return;
    setCopyResult(null);
    setCopyError(null);
    startTransition(async () => {
      const result = await copyCovoiturageToDate(projetId, date, copyDate);
      if (result?.error) setCopyError(result.error);
      else {
        setCopyResult(
          result?.applied
            ? `Organisation appliquée à ${result.applied} booking${result.applied > 1 ? "s" : ""} du ${formatDateShort(copyDate)}.`
            : `Personne en commun entre les deux journées.`
        );
        router.refresh();
      }
    });
  }

  function droppedFigurantIds(e: DragEvent): string[] {
    const raw = e.dataTransfer.getData("text/figurant-ids");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }

  const conducteurs = useMemo(
    () => rows.filter((r) => r.covoiturage_role === "conducteur"),
    [rows]
  );
  const ppm = useMemo(() => sortByNomFamille(rows.filter((r) => r.covoiturage_role === "ppm")), [rows]);
  const transportCommun = useMemo(
    () => sortByNomFamille(rows.filter((r) => r.covoiturage_role === "transport_commun")),
    [rows]
  );
  const sansCovoiturage = useMemo(() => rows.filter((r) => !r.covoiturage_role), [rows]);
  const sansCovoiturageGroups = useMemo(() => groupByCodePostal(sansCovoiturage), [sansCovoiturage]);

  function update(id: string, changes: Parameters<typeof bulkUpdateBookings>[1]) {
    startTransition(async () => {
      await bulkUpdateBookings([id], changes);
      router.refresh();
    });
  }

  function setRole(r: CovoiturageRow, role: CovoiturageRole | "") {
    update(r.id, {
      covoiturage_role: role || null,
      ...(role !== "conducteur" ? { covoiturage_lieu_depart: null, covoiturage_places_disponibles: null } : {}),
      ...(role !== "passager" ? { covoiturage_conducteur_id: null } : {}),
    });
  }

  function bookingIdsFor(figurantIds: string[]) {
    const set = new Set(figurantIds);
    return rows.filter((r) => set.has(r.figurant_id)).map((r) => r.id);
  }

  // Toutes les actions ci-dessous acceptent un lot de figurant_id (1 ou
  // plusieurs, selon la sélection au moment du drop) et ne font qu'un seul
  // appel serveur pour tout le lot — voir bulkUpdateBookings.
  function assignToConducteur(figurantIds: string[], conducteurFigurantId: string) {
    const ids = bookingIdsFor(figurantIds.filter((id) => id !== conducteurFigurantId));
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkUpdateBookings(ids, { covoiturage_role: "passager", covoiturage_conducteur_id: conducteurFigurantId });
      router.refresh();
    });
    setSelectedIds(new Set());
  }

  function promoteToConducteur(figurantIds: string[]) {
    const ids = bookingIdsFor(figurantIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkUpdateBookings(ids, { covoiturage_role: "conducteur", covoiturage_conducteur_id: null });
      router.refresh();
    });
    setSelectedIds(new Set());
  }

  function setRoleForMany(figurantIds: string[], role: CovoiturageRole) {
    const ids = bookingIdsFor(figurantIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkUpdateBookings(ids, {
        covoiturage_role: role,
        covoiturage_lieu_depart: null,
        covoiturage_places_disponibles: null,
        covoiturage_conducteur_id: null,
      });
      router.refresh();
    });
    setSelectedIds(new Set());
  }

  // Un·e conducteur·rice qu'on désassigne libère aussi ses passager·ères
  // (sinon ils pointent vers un conducteur_id qui n'a plus le rôle) — géré
  // ici pour que ça marche pareil que ce soit une seule personne ou un lot.
  function unassign(figurantIds: string[]) {
    const set = new Set(figurantIds);
    const directRows = rows.filter((r) => set.has(r.figurant_id));
    const conducteurIds = new Set(
      directRows.filter((r) => r.covoiturage_role === "conducteur").map((r) => r.figurant_id)
    );
    const cascadeIds = rows
      .filter((r) => r.covoiturage_conducteur_id && conducteurIds.has(r.covoiturage_conducteur_id))
      .map((r) => r.id);
    const ids = Array.from(new Set([...directRows.map((r) => r.id), ...cascadeIds]));
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkUpdateBookings(ids, {
        covoiturage_role: null,
        covoiturage_lieu_depart: null,
        covoiturage_places_disponibles: null,
        covoiturage_conducteur_id: null,
      });
      router.refresh();
    });
    setSelectedIds(new Set());
  }

  function sendCovoiturageMessage(r: CovoiturageRow) {
    if (!r.figurants) return;
    let body: string | null = null;
    const subject = `Covoiturage – ${date}`;

    if (r.covoiturage_role === "conducteur") {
      const passagers = rows
        .filter((p) => p.covoiturage_conducteur_id === r.figurant_id)
        .map((p) => ({ prenom: p.figurants?.prenom ?? "", nom: p.figurants?.nom ?? "", telephone: p.figurants?.telephone ?? null, email: p.figurants?.email ?? null }));
      body = buildChauffeurMessage({
        prenom: r.figurants.prenom,
        lieu: r.covoiturage_lieu_depart,
        date,
        heure: null,
        passagers,
        tarifBase,
        tarifPassager,
      });
    } else if (r.covoiturage_role === "passager" && r.covoiturage_conducteur_id) {
      const chauffeur = conducteurs.find((c) => c.figurant_id === r.covoiturage_conducteur_id);
      if (!chauffeur?.figurants) return;
      body = buildPassagerMessage({
        prenom: r.figurants.prenom,
        lieu: chauffeur.covoiturage_lieu_depart,
        date,
        heure: null,
        chauffeur: {
          prenom: chauffeur.figurants.prenom,
          nom: chauffeur.figurants.nom,
          telephone: chauffeur.figurants.telephone,
          email: chauffeur.figurants.email,
        },
      });
    }

    if (!body) return;
    const target = contactHref(
      { prenom: r.figurants.prenom, nom: r.figurants.nom, telephone: r.figurants.telephone, email: r.figurants.email },
      body,
      subject
    );
    if (!target) return;
    if (target.kind === "sms") {
      openHref(target.href);
      startTransition(async () => {
        await recordCovoiturageMessage(r.figurant_id, body!, null, undefined, projetId);
      });
      setSentIds((prev) => new Set([...prev, r.id]));
      return;
    }
    setSendError(null);
    startTransition(async () => {
      const result = await recordCovoiturageMessage(r.figurant_id, body!, r.figurants!.email, subject, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
      else setSentIds((prev) => new Set([...prev, r.id]));
    });
  }

  const eligibles = rows.filter(
    (r) => r.covoiturage_role === "conducteur" || (r.covoiturage_role === "passager" && r.covoiturage_conducteur_id)
  );

  const groups: { label: string; rows: CovoiturageRow[] }[] = [
    { label: "Conducteurs", rows: conducteurs },
    { label: "Passagers", rows: rows.filter((r) => r.covoiturage_role === "passager") },
    { label: "PPM (par ses propres moyens)", rows: ppm },
    { label: "Transport en commun", rows: transportCommun },
  ];

  function TrombiCard({ r, onRemove, onMessage }: { r: CovoiturageRow; onRemove?: () => void; onMessage?: () => void }) {
    const checked = selectedIds.has(r.figurant_id);
    return (
      <div
        draggable
        onDragStart={(e) => {
          // Si cette carte fait partie d'une sélection multiple, on
          // embarque tout le lot — sinon juste elle, comme avant.
          const ids = checked && selectedIds.size > 1 ? Array.from(selectedIds) : [r.figurant_id];
          e.dataTransfer.setData("text/figurant-ids", JSON.stringify(ids));
        }}
        className={cn(
          "group relative flex w-24 shrink-0 cursor-grab flex-col items-center gap-1 rounded-xl border p-2 text-center active:cursor-grabbing",
          checked ? "border-coral bg-coral/10" : "border-border bg-ink"
        )}
      >
        <label
          className="absolute left-1 top-1 z-10 flex h-4 w-4 items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleSelected(r.figurant_id)}
            className="h-3.5 w-3.5 rounded border-border accent-coral"
          />
        </label>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 z-10 hidden h-4 w-4 items-center justify-center rounded-full bg-ink-raised-2 text-[10px] text-text-muted hover:bg-danger hover:text-ink group-hover:flex"
            title="Retirer"
          >
            ×
          </button>
        )}
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
          {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
        </div>
        <span className="block w-full truncate text-xs font-medium">
          {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
        </span>
        {lieuLabel(r) && (
          <span className="block w-full truncate text-[9px] leading-tight text-text-muted">{lieuLabel(r)}</span>
        )}
        <ContactIcons r={r} />
        {onMessage && (r.figurants?.telephone || r.figurants?.email) && (
          <button
            type="button"
            onClick={onMessage}
            className="w-full truncate rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted hover:border-coral/60 hover:text-text"
          >
            Rappel {r.figurants?.telephone ? "texto" : "email"}
          </button>
        )}
      </div>
    );
  }

  // Contact générique, indépendant du rôle covoiturage — pour joindre
  // rapidement qui que ce soit (même « Sans covoiturage ») sans passer par
  // le message de rappel covoiturage (celui-ci reste réservé aux
  // conducteur·rices/passager·ères, voir onMessage sur TrombiCard/ListeRow).
  function ContactIcons({ r }: { r: CovoiturageRow }) {
    const tel = r.figurants?.telephone;
    const email = r.figurants?.email;
    if (!tel && !email) return null;
    const iconClass =
      "flex h-6 flex-1 items-center justify-center rounded-md border border-border text-xs text-text-muted hover:border-coral/60 hover:text-text";
    return (
      <div className="flex w-full gap-1" onClick={(e) => e.stopPropagation()}>
        {tel && (
          <a href={`tel:${tel.replace(/\s+/g, "")}`} className={iconClass} title="Appeler" draggable={false}>
            📞
          </a>
        )}
        {tel && (
          <a href={smsConversationHref(tel)} className={iconClass} title="Texto" draggable={false}>
            💬
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className={iconClass} title="Email" draggable={false}>
            ✉️
          </a>
        )}
      </div>
    );
  }

  function ListeRow({ r }: { r: CovoiturageRow }) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-ink-raised px-4 py-3">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
          {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
        </div>
        <div className="w-36 shrink-0">
          <div className="truncate font-medium">{r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}</div>
          {lieuLabel(r) && <div className="truncate text-[11px] text-text-muted">{lieuLabel(r)}</div>}
        </div>

        <div className="flex w-24 shrink-0 gap-1">
          <ContactIcons r={r} />
        </div>

        <select
          value={r.covoiturage_role ?? ""}
          disabled={pending}
          onChange={(e) => setRole(r, e.target.value as CovoiturageRole | "")}
          className={`${fieldClass} w-36`}
        >
          <option value="">Aucun</option>
          {COVOITURAGE_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>

        {r.covoiturage_role === "conducteur" && (
          <>
            <input
              defaultValue={r.covoiturage_lieu_depart ?? ""}
              placeholder="Lieu de départ"
              disabled={pending}
              className={`${fieldClass} w-48`}
              onBlur={(e) => {
                const value = e.target.value.trim() || null;
                if (value !== r.covoiturage_lieu_depart) update(r.id, { covoiturage_lieu_depart: value });
              }}
            />
            <input
              type="number"
              min={0}
              defaultValue={r.covoiturage_places_disponibles ?? ""}
              placeholder="Places"
              disabled={pending}
              className={`${fieldClass} w-24`}
              onBlur={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                if (value !== r.covoiturage_places_disponibles)
                  update(r.id, { covoiturage_places_disponibles: value });
              }}
            />
          </>
        )}

        {r.covoiturage_role === "passager" && (
          <select
            value={r.covoiturage_conducteur_id ?? ""}
            disabled={pending}
            onChange={(e) => update(r.id, { covoiturage_conducteur_id: e.target.value || null })}
            className={`${fieldClass} w-48`}
          >
            <option value="">Choisir un conducteur</option>
            {conducteurs
              .filter((c) => c.figurant_id !== r.figurant_id)
              .map((c) => (
                <option key={c.figurant_id} value={c.figurant_id}>
                  {c.figurants ? `${c.figurants.prenom} ${c.figurants.nom}` : "—"}
                  {c.covoiturage_lieu_depart ? ` · ${c.covoiturage_lieu_depart}` : ""}
                </option>
              ))}
          </select>
        )}

        {(r.covoiturage_role === "conducteur" ||
          (r.covoiturage_role === "passager" && r.covoiturage_conducteur_id)) && (
          <button
            type="button"
            onClick={() => sendCovoiturageMessage(r)}
            disabled={!r.figurants?.telephone && !r.figurants?.email}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text disabled:opacity-30"
          >
            {r.figurants?.telephone ? "Texto" : r.figurants?.email ? "Email" : "Pas de contact"}
          </button>
        )}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">Aucun booking pour cette journée.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sendError && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{sendError}</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Vue :</span>
        {[
          { value: "trombi" as const, label: "Trombinoscope" },
          { value: "liste" as const, label: "Liste" },
        ].map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setViewMode(v.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              viewMode === v.value
                ? "border-coral bg-coral/15 text-coral"
                : "border-border text-text-muted hover:text-text"
            )}
          >
            {v.label}
          </button>
        ))}
        {selectedIds.size > 0 && (
          <span className="flex items-center gap-2 rounded-full border border-coral/40 bg-coral/10 px-3 py-1 text-xs font-medium text-coral">
            {selectedIds.size} sélectionné·e{selectedIds.size > 1 ? "s" : ""}
            <button type="button" onClick={() => setSelectedIds(new Set())} className="hover:underline">
              Désélectionner
            </button>
          </span>
        )}
        {autresDates.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            className={eligibles.length > 0 ? "" : "ml-auto"}
            onClick={() => {
              setCopyOpen((v) => !v);
              setCopyResult(null);
              setCopyError(null);
            }}
          >
            📅 Appliquer à un autre jour
          </Button>
        )}
        {eligibles.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            className={autresDates.length > 0 ? "" : "ml-auto"}
            onClick={() => setBulkOpen((v) => !v)}
          >
            Envoyer à tous les covoiturés ({eligibles.length})
          </Button>
        )}
        {pending && <span className="text-xs text-text-muted">Mise à jour...</span>}
      </div>

      {copyOpen && (
        <div className="flex flex-col gap-2 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Appliquer cette organisation à une autre journée</span>
            <button type="button" onClick={() => setCopyOpen(false)} className="text-text-muted hover:text-coral">
              Fermer
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Copie le rôle (conducteur·rice/passager·ère/PPM/transport en commun), le lieu et les places de cette
            journée vers l&apos;autre, pour les profils raccord (booké·es les deux jours) — les autres ne sont pas
            touché·es.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={copyDate}
              onChange={(e) => setCopyDate(e.target.value)}
              className={`${fieldClass} w-40`}
            >
              {autresDates.map((d) => (
                <option key={d} value={d}>
                  {formatDateShort(d)}
                </option>
              ))}
            </select>
            <Button type="button" disabled={pending || !copyDate} onClick={applyCopy}>
              {pending ? "Application..." : "Appliquer"}
            </Button>
          </div>
          {copyError && <p className="text-sm text-danger">{copyError}</p>}
          {copyResult && <p className="text-sm text-turquoise">{copyResult}</p>}
        </div>
      )}

      {bulkOpen && (
        <div className="flex flex-col gap-2 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Envoyer le texto/email de covoiturage à chacun ({sentIds.size}/{eligibles.length} envoyés)
            </span>
            <button type="button" onClick={() => setBulkOpen(false)} className="text-text-muted hover:text-coral">
              Fermer
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {eligibles.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                  <span className="ml-2 text-xs text-text-muted">
                    {r.covoiturage_role === "conducteur" ? "Chauffeur" : "Passager"}
                  </span>
                  {!r.figurants?.telephone && !r.figurants?.email && (
                    <span className="ml-2 text-xs text-danger">Pas de contact</span>
                  )}
                </span>
                <Button
                  type="button"
                  variant={sentIds.has(r.id) ? "ghost" : "secondary"}
                  disabled={!r.figurants?.telephone && !r.figurants?.email}
                  onClick={() => sendCovoiturageMessage(r)}
                >
                  {sentIds.has(r.id) ? "Envoyé" : r.figurants?.telephone ? "Texto" : "Email"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "trombi" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted">
            Glisse un profil sur un·e chauffeur·euse pour l&apos;ajouter comme passager·ère, sur « + Nouveau·elle
            chauffeur·euse » pour le·la promouvoir, ou sur PPM / Transport en commun pour le·la classer là. Coche
            plusieurs profils (case en haut à gauche de chaque photo) pour les glisser tous en même temps.
          </p>

          <div className="flex flex-wrap items-start gap-4">
            {conducteurs.map((c) => {
              const passagers = rows.filter((r) => r.covoiturage_conducteur_id === c.figurant_id);
              const zoneKey = `conducteur-${c.figurant_id}`;
              return (
                <div
                  key={c.figurant_id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverZone(zoneKey);
                  }}
                  onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    const ids = droppedFigurantIds(e);
                    if (ids.length > 0) assignToConducteur(ids, c.figurant_id);
                  }}
                  className={cn(
                    "flex w-64 shrink-0 flex-col gap-3 rounded-2xl border p-3 transition-colors",
                    dragOverZone === zoneKey ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <TrombiCard r={c} onRemove={() => unassign([c.figurant_id])} onMessage={() => sendCovoiturageMessage(c)} />
                    <div className="flex flex-1 flex-col gap-1">
                      <input
                        defaultValue={c.covoiturage_lieu_depart ?? ""}
                        placeholder="Lieu de départ"
                        disabled={pending}
                        className={fieldClass}
                        onBlur={(e) => {
                          const value = e.target.value.trim() || null;
                          if (value !== c.covoiturage_lieu_depart) update(c.id, { covoiturage_lieu_depart: value });
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.covoiturage_places_disponibles ?? ""}
                        placeholder="Places"
                        disabled={pending}
                        className={fieldClass}
                        onBlur={(e) => {
                          const value = e.target.value ? Number(e.target.value) : null;
                          if (value !== c.covoiturage_places_disponibles)
                            update(c.id, { covoiturage_places_disponibles: value });
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {passagers.map((p) => (
                      <TrombiCard
                        key={p.id}
                        r={p}
                        onRemove={() => unassign([p.figurant_id])}
                        onMessage={() => sendCovoiturageMessage(p)}
                      />
                    ))}
                    {passagers.length === 0 && (
                      <p className="w-full rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-text-muted">
                        Glisser ici
                      </p>
                    )}
                  </div>
                  <div className="border-t border-border pt-2">
                    <span className="text-[11px] text-text-muted">
                      Indemnité : {montantCovoiturage(passagers.length, tarifBase, tarifPassager)}€
                    </span>
                  </div>
                </div>
              );
            })}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZone("nouveau-conducteur");
              }}
              onDragLeave={() => setDragOverZone((z) => (z === "nouveau-conducteur" ? null : z))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverZone(null);
                const ids = droppedFigurantIds(e);
                if (ids.length > 0) promoteToConducteur(ids);
              }}
              className={cn(
                "flex w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-4 text-center text-xs text-text-muted transition-colors",
                dragOverZone === "nouveau-conducteur" ? "border-coral bg-coral/10 text-coral" : "border-border"
              )}
            >
              + Nouveau·elle chauffeur·euse
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZone("ppm");
              }}
              onDragLeave={() => setDragOverZone((z) => (z === "ppm" ? null : z))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverZone(null);
                const ids = droppedFigurantIds(e);
                if (ids.length > 0) setRoleForMany(ids, "ppm");
              }}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border p-3 transition-colors",
                dragOverZone === "ppm" ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">PPM ({ppm.length})</h3>
                {ppm.length > 0 && (
                  <span className="text-[10px] text-text-muted">Indemnité : {tarifBase}€/personne</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {ppm.map((r) => (
                  <TrombiCard key={r.id} r={r} onRemove={() => unassign([r.figurant_id])} />
                ))}
                {ppm.length === 0 && <p className="text-[11px] text-text-muted">Glisser ici</p>}
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZone("transport-commun");
              }}
              onDragLeave={() => setDragOverZone((z) => (z === "transport-commun" ? null : z))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverZone(null);
                const ids = droppedFigurantIds(e);
                if (ids.length > 0) setRoleForMany(ids, "transport_commun");
              }}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border p-3 transition-colors",
                dragOverZone === "transport-commun" ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
              )}
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Transport en commun ({transportCommun.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {transportCommun.map((r) => (
                  <TrombiCard key={r.id} r={r} onRemove={() => unassign([r.figurant_id])} />
                ))}
                {transportCommun.length === 0 && <p className="text-[11px] text-text-muted">Glisser ici</p>}
              </div>
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone("sans-covoiturage");
            }}
            onDragLeave={() => setDragOverZone((z) => (z === "sans-covoiturage" ? null : z))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverZone(null);
              const ids = droppedFigurantIds(e);
              if (ids.length > 0) unassign(ids);
            }}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-3 transition-colors",
              dragOverZone === "sans-covoiturage" ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Sans covoiturage ({sansCovoiturage.length})
              </h3>
              {sansCovoiturage.length > 0 && (
                <span className="text-[10px] text-text-muted">Groupé par code postal, trié par nom</span>
              )}
            </div>
            {sansCovoiturage.length === 0 ? (
              <p className="text-xs text-text-muted">Tout le monde a un covoiturage.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sansCovoiturageGroups.map((g) => (
                  <div key={g.codePostal || "—"} className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted/80">
                      {g.codePostal || "Code postal non renseigné"} ({g.rows.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {g.rows.map((r) => (
                        <TrombiCard key={r.id} r={r} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === "liste" && (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-muted">
                {g.label} ({g.rows.length})
              </h3>
              {g.rows.length === 0 ? (
                <p className="text-sm text-text-muted">—</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {g.rows.map((r) => (
                    <ListeRow key={r.id} r={r} />
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-muted">Sans covoiturage ({sansCovoiturage.length})</h3>
              {sansCovoiturage.length > 0 && (
                <span className="text-[11px] text-text-muted">Groupé par code postal, trié par nom</span>
              )}
            </div>
            {sansCovoiturage.length === 0 ? (
              <p className="text-sm text-text-muted">—</p>
            ) : (
              <div className="flex flex-col gap-3">
                {sansCovoiturageGroups.map((g) => (
                  <div key={g.codePostal || "—"} className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted/80">
                      {g.codePostal || "Code postal non renseigné"} ({g.rows.length})
                    </span>
                    <div className="flex flex-col gap-2">
                      {g.rows.map((r) => (
                        <ListeRow key={r.id} r={r} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
