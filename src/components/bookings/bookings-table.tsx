"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { StatusSelect } from "@/components/ui/status-select";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  bulkUpdateBookings,
  recordBookingMessage,
  sendBulkConvocations,
  sendEspacePersoLinkBulk,
  resetConvocationEnvoyee,
} from "@/lib/bookings/actions";
import { applyIndemniteToBookings } from "@/lib/indemnites/actions";
import type { ProjetIndemnite } from "@/lib/indemnites/types";
import { applyMajorationToBookings } from "@/lib/bareme/actions";
import { formatMajorationValeur, type BaremeMajoration, type MajorationValeurType } from "@/lib/bareme/types";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";
import { checkEmailReplies, clearUnreviewedReplies } from "@/lib/bookings/inbox-actions";
import { sendFigurantsToEssayage } from "@/lib/essayages/actions";
import { toggleMessageRepondu } from "@/lib/figurants/messages-actions";
import type { InboxReply } from "@/lib/email/inbox";
import { STATUTS, type BookingStatut } from "@/lib/bookings/types";
import { CACHETS } from "@/lib/candidatures/types";
import { computeAge } from "@/lib/documents/fields";
import { buildConvocationMailto, substituteTokens, type ConvocationSettings } from "@/lib/bookings/convocation";
import { smsConversationHref } from "@/lib/bookings/covoiturage-messages";
import { projetNomPublic } from "@/lib/projets/types";
import { FIGURANT_MESSAGE_CATEGORIES, type FigurantMessageCategorie } from "@/lib/candidats/types";
import { formatDateTime as formatMessageDateTime, formatDelai } from "@/lib/format-date";
import type { Genre } from "@/lib/figurants/types";
import type { MessageTemplate } from "@/lib/templates/types";

export type MessageRow = {
  id: string;
  sender: "staff" | "figurant";
  categorie: FigurantMessageCategorie;
  sujet: string | null;
  corps: string;
  created_at: string;
  repondu: boolean;
};

// Mail (Mac) n'a pas d'URL publique pour ouvrir une recherche pré-remplie
// (contrairement à Gmail) — on copie donc le texte pour un collage manuel
// dans la barre de recherche de l'app mail/SMS.
async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
    } catch {
      // Aucun mécanisme de copie disponible dans ce navigateur.
    }
    document.body.removeChild(textarea);
  }
}

export type Row = {
  id: string;
  figurant_id?: string;
  date: string;
  heure_convocation: string | null;
  fonction: string | null;
  cachet: string | null;
  statut: BookingStatut;
  convocation_envoyee: boolean;
  convocation_envoyee_le?: string | null;
  reponse_recue: boolean;
  reponse_recue_le?: string | null;
  notes: string | null;
  covoiturage_role?: "conducteur" | "passager" | null;
  covoiturage_lieu_depart?: string | null;
  covoiturage_conducteur_id?: string | null;
  figurants: {
    prenom: string;
    nom: string;
    ville: string | null;
    email: string | null;
    telephone: string | null;
    genre: Genre | null;
    date_naissance: string | null;
  } | null;
  projets: { nom: string; confidentiel: boolean; nom_code?: string | null; lieu: string | null; signature: string | null } | null;
  portraitUrl: string | null;
  essaiOk?: boolean;
  numeroCostume?: string | null;
  indispoMotif?: string | null;
  raccord?: boolean;
  autresDates?: { date: string; statut: string }[];
  indemnites?: { id: string; label: string; montant: number }[];
  majorations?: { id: string; label: string; valeur_type: MajorationValeurType; valeur: number | null }[];
};

// Petit badge "R" pour repérer en un coup d'œil un jour de suite (raccord) —
// la personne a déjà une journée antérieure sur ce même projet. Cliquable
// pour dérouler toutes ses dates sur ce projet avec leur statut.
function RaccordBadge({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      title="Raccord — cliquer pour voir toutes ses dates sur ce projet"
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none",
        expanded ? "bg-ink text-coral ring-1 ring-coral" : "bg-coral text-ink"
      )}
    >
      R
    </button>
  );
}

function RaccordDatesList({ dates }: { dates: { date: string; statut: string }[] }) {
  if (dates.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-coral/30 bg-coral/5 px-2 py-1.5 text-[11px]">
      <span className="font-medium text-text-muted">Autres dates sur ce projet :</span>
      {[...dates]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => (
          <span key={d.date} className="flex items-center justify-between gap-2">
            <span>{d.date}</span>
            <span className="text-text-muted">{d.statut}</span>
          </span>
        ))}
    </div>
  );
}

function covoiturageReminderLine(r: Row, rows: Row[]): string | null {
  if (r.covoiturage_role === "conducteur") {
    const passagers = rows.filter((p) => p.covoiturage_conducteur_id === r.figurant_id);
    if (passagers.length === 0) return null;
    const noms = passagers.map((p) => p.figurants?.prenom).filter(Boolean).join(", ");
    return `Rappel covoiturage : vous conduisez ${noms}. Départ : ${r.covoiturage_lieu_depart ?? "à confirmer"}.`;
  }
  if (r.covoiturage_role === "passager" && r.covoiturage_conducteur_id) {
    const chauffeur = rows.find((c) => c.figurant_id === r.covoiturage_conducteur_id);
    if (!chauffeur?.figurants) return null;
    const tel = chauffeur.figurants.telephone ? ` (${chauffeur.figurants.telephone})` : "";
    return `Rappel covoiturage : vous êtes avec ${chauffeur.figurants.prenom} ${chauffeur.figurants.nom}${tel}. Départ : ${chauffeur.covoiturage_lieu_depart ?? "à confirmer"}.`;
  }
  return null;
}

function rowTokens(r: Row, journeeLieu?: string | null) {
  // Raccord : la personne a d'autres dates sur ce même projet — le token
  // {date} les liste toutes plutôt que juste celle de cette journée.
  const autresDates = (r.autresDates ?? []).filter((d) => d.statut !== "annulé").map((d) => d.date);
  const allDates = Array.from(new Set([r.date, ...autresDates])).sort();

  return {
    prenom: r.figurants?.prenom ?? "",
    projet: projetNomPublic(r.projets, "notre tournage"),
    date: allDates.join(", "),
    lieu: journeeLieu || r.projets?.lieu || "",
    cachet: r.cachet ?? "",
    fonction: r.fonction ?? "",
    signature: r.projets?.signature ?? "",
  };
}

const DEFAULT_LIBRE_BODY = "Bonjour {prenom},\n\n";

const AGE_BRACKETS = [
  { key: "-18", label: "- 18 ans", test: (age: number) => age < 18 },
  { key: "18-30", label: "18-30 ans", test: (age: number) => age >= 18 && age <= 30 },
  { key: "31-50", label: "31-50 ans", test: (age: number) => age >= 31 && age <= 50 },
  { key: "51+", label: "51 ans +", test: (age: number) => age >= 51 },
] as const;

function ageBracketKey(dateNaissance: string | null): string | null {
  const age = computeAge(dateNaissance);
  if (age === null) return null;
  return AGE_BRACKETS.find((b) => b.test(age))?.key ?? null;
}

type RowChanges = Partial<{
  statut: BookingStatut;
  fonction: string | null;
  cachet: string | null;
  heure_convocation: string | null;
  reponse_recue: boolean;
  notes: string | null;
}>;
type Dimension = "fonction" | "cachet" | "statut" | "sexe" | "age" | "heure" | "repondu";

const GROUP_DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "fonction", label: "Fonction" },
  { key: "cachet", label: "Cachet" },
  { key: "statut", label: "Statut" },
  { key: "sexe", label: "Genre" },
  { key: "age", label: "Âge" },
  { key: "heure", label: "Heure" },
  { key: "repondu", label: "Répondu" },
];

// Dimensions transposables telles quelles vers le tri additif des documents
// (trombis/fiches) — "statut" n'existe pas là-bas, ces docs ne montrant que
// des bookings confirmés.
const DOCUMENT_SORT_DIMENSIONS = new Set<Dimension>(["fonction", "cachet", "sexe", "age", "heure"]);

type Group = { label: string | null; rows: Row[] };

function dimensionLabel(r: Row, dimension: Dimension) {
  if (dimension === "statut") return STATUTS.find((s) => s.value === r.statut)?.label ?? r.statut;
  if (dimension === "fonction") return r.fonction ?? "Sans fonction";
  if (dimension === "cachet") return r.cachet ?? "Sans cachet";
  if (dimension === "sexe") return r.figurants?.genre ?? "Non renseigné";
  if (dimension === "heure") return r.heure_convocation ? r.heure_convocation.slice(0, 5) : "Sans heure";
  if (dimension === "repondu") return r.reponse_recue ? "Répondu" : "Pas répondu";
  const bracket = AGE_BRACKETS.find((b) => b.key === ageBracketKey(r.figurants?.date_naissance ?? null));
  return bracket?.label ?? "Âge non renseigné";
}

function nowIso() {
  return new Date().toISOString();
}

// Convocations envoyées en général la veille du tournage — le délai qui
// compte est en minutes/heures, pas en jours.
function convocationDelai(r: Row, now: string): { text: string; muted?: boolean } | null {
  if (r.reponse_recue && r.reponse_recue_le && r.convocation_envoyee_le) {
    return { text: `Répondu en ${formatDelai(r.convocation_envoyee_le, r.reponse_recue_le)}` };
  }
  if (!r.reponse_recue && r.convocation_envoyee && r.convocation_envoyee_le) {
    return { text: `Envoyée il y a ${formatDelai(r.convocation_envoyee_le, now)}`, muted: true };
  }
  return null;
}

function repondusSuffix(rowsList: Row[]) {
  const concernes = rowsList.filter((r) => r.convocation_envoyee);
  if (concernes.length === 0) return "";
  const repondus = concernes.filter((r) => r.reponse_recue).length;
  return ` — ${repondus}/${concernes.length} répondu${repondus > 1 ? "s" : ""}`;
}

// Tri/regroupement additif : chaque dimension cliquée s'ajoute à la liste,
// dans l'ordre de clic — la première groupe en premier, la suivante affine
// chaque groupe. Liste vide = pas de groupement (ordre par défaut).
function groupRows(rows: Row[], dims: Dimension[]): Group[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const key = dims.map((d) => dimensionLabel(r, d)).join(" · ");
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, groupRows]) => ({ label, rows: groupRows }));
}

const fieldClass =
  "w-full rounded-lg border border-border bg-ink px-2 py-1.5 text-xs outline-none focus:border-coral disabled:opacity-60";

const STATUTS_ARCHIVES = new Set<BookingStatut>(["indisponible", "annulé"]);

export function BookingsTable({
  rows,
  projetId,
  date,
  templates = [],
  journeeLieu = null,
  convocationSettings = null,
  initialReplies = [],
  messagesByFigurant = {},
  projetIndemnites = [],
  baremeMajorations = [],
}: {
  rows: Row[];
  projetId?: string;
  date?: string;
  templates?: MessageTemplate[];
  journeeLieu?: string | null;
  convocationSettings?: ConvocationSettings | null;
  initialReplies?: InboxReply[];
  messagesByFigurant?: Record<string, MessageRow[]>;
  projetIndemnites?: ProjetIndemnite[];
  baremeMajorations?: BaremeMajoration[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [activeFonction, setActiveFonction] = useState<string | null>(null);
  const [activeCachet, setActiveCachet] = useState<string | null>(null);
  const [groupDims, setGroupDims] = useState<Dimension[]>(["fonction", "cachet"]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [onlyNonRepondus, setOnlyNonRepondus] = useState(false);
  const [bulkFonction, setBulkFonction] = useState("");
  const [bulkHeure, setBulkHeure] = useState("08:00");
  const [viewMode, setViewMode] = useState<"liste" | "trombi">("trombi");
  const [essayageOpen, setEssayageOpen] = useState(false);
  const [addDatesOpen, setAddDatesOpen] = useState(false);
  const [espacePersoOpen, setEspacePersoOpen] = useState(false);
  const [espacePersoResult, setEspacePersoResult] = useState<{ sent: number; failed: number } | null>(null);
  const [essayageDate, setEssayageDate] = useState("");
  const [essayageLieu, setEssayageLieu] = useState("");
  const [essayageResult, setEssayageResult] = useState<string | null>(null);
  const [messageMode, setMessageMode] = useState<"none" | "convocation-confirm" | "libre-compose" | "libre-confirm">(
    "none"
  );
  const [libreSubject, setLibreSubject] = useState(`Message – ${date ?? ""}`);
  const [libreMessage, setLibreMessage] = useState(DEFAULT_LIBRE_BODY);
  const [sendPending, setSendPending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped?: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [repliesPending, setRepliesPending] = useState(false);
  const [replies, setReplies] = useState<InboxReply[]>(initialReplies);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [lastCheckInfo, setLastCheckInfo] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [expandedRaccord, setExpandedRaccord] = useState<Set<string>>(new Set());

  function toggleRaccordExpanded(id: string) {
    setExpandedRaccord((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMessagesExpanded(id: string) {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRepondu(messageId: string, value: boolean) {
    startTransition(async () => {
      await toggleMessageRepondu(messageId, value);
      router.refresh();
    });
  }

  const now = nowIso();

  const fonctions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.fonction).filter((f): f is string => !!f))).sort(),
    [rows]
  );

  const cachetCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.cachet) counts.set(r.cachet, (counts.get(r.cachet) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const archivedCount = rows.filter((r) => STATUTS_ARCHIVES.has(r.statut)).length;

  const activeRows = rows.filter((r) => !STATUTS_ARCHIVES.has(r.statut));
  const reponduCount = activeRows.filter((r) => r.reponse_recue).length;
  const nonRepondusCount = activeRows.filter((r) => r.convocation_envoyee && !r.reponse_recue).length;

  const filteredRows = rows.filter(
    (r) =>
      (!activeFonction || r.fonction === activeFonction) &&
      (!activeCachet || r.cachet === activeCachet) &&
      !hiddenIds.has(r.id) &&
      (showArchived || !STATUTS_ARCHIVES.has(r.statut)) &&
      (!onlyNonRepondus || (r.convocation_envoyee && !r.reponse_recue))
  );

  const groups = useMemo((): Group[] => {
    if (groupDims.length === 0) return [{ label: null, rows: filteredRows }];
    return groupRows(filteredRows, groupDims);
  }, [groupDims, filteredRows]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function documentHref(path: "trombis" | "fiches") {
    const params = new URLSearchParams({ projet_id: projetId ?? "", date: date ?? "" });
    for (const dim of groupDims) {
      if (DOCUMENT_SORT_DIMENSIONS.has(dim)) params.append("sort", dim);
    }
    if (selected.size > 0) params.set("booking_ids", Array.from(selected).join(","));
    return `/bookings/documents/${path}?${params.toString()}`;
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.id))
    );
  }

  function toggleGroup(groupRows: Row[]) {
    const allSelected = groupRows.every((r) => selected.has(r.id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of groupRows) {
        if (allSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  function applyBulkStatut(statut: string) {
    if (!statut || selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateBookings(ids, { statut: statut as BookingStatut });
      setSelected(new Set());
      router.refresh();
    });
  }

  function applyBulkFonction() {
    if (!bulkFonction.trim() || selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateBookings(ids, { fonction: bulkFonction.trim() });
      setSelected(new Set());
      setBulkFonction("");
      router.refresh();
    });
  }

  function applyBulkCachet(cachet: string) {
    if (!cachet || selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateBookings(ids, { cachet });
      setSelected(new Set());
      router.refresh();
    });
  }

  function applyBulkHeure() {
    if (!bulkHeure || selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkUpdateBookings(ids, { heure_convocation: bulkHeure });
      setSelected(new Set());
      setBulkHeure("");
      router.refresh();
    });
  }

  function applyBulkIndemnite(projetIndemniteId: string) {
    if (!projetIndemniteId || selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await applyIndemniteToBookings(ids, projetIndemniteId);
      setSelected(new Set());
      router.refresh();
    });
  }

  function applyBulkMajoration(baremeMajorationId: string) {
    if (!baremeMajorationId || selected.size === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await applyMajorationToBookings(ids, baremeMajorationId);
      setSelected(new Set());
      router.refresh();
    });
  }

  function hideSelection() {
    setHiddenIds((prev) => new Set([...prev, ...selected]));
    setSelected(new Set());
  }

  function sendEspacePerso() {
    if (!projetId || selectedWithEmail.length === 0) return;
    setEspacePersoResult(null);
    startTransition(async () => {
      const result = await sendEspacePersoLinkBulk(
        selectedWithEmail.map((r) => r.figurant_id!),
        projetId
      );
      if (result.error) {
        setEspacePersoResult({ sent: 0, failed: selectedWithEmail.length });
        return;
      }
      setEspacePersoResult({ sent: result.sent ?? 0, failed: result.failed ?? 0 });
      if (!result.failed) {
        setSelected(new Set());
        setEspacePersoOpen(false);
      }
    });
  }

  function sendToEssayage() {
    if (!projetId || !essayageDate || selected.size === 0) return;
    const figurantIds = rows
      .filter((r) => selected.has(r.id) && r.figurant_id)
      .map((r) => r.figurant_id!);
    setEssayageResult(null);
    startTransition(async () => {
      const result = await sendFigurantsToEssayage(figurantIds, projetId, essayageDate, essayageLieu.trim() || null);
      if (result.error) {
        setEssayageResult(result.error);
        return;
      }
      setEssayageResult(
        `${result.added} envoyé(s)${result.skipped ? `, ${result.skipped} déjà présent(s)` : ""}.`
      );
      setSelected(new Set());
    });
  }

  function checkReplies() {
    setRepliesPending(true);
    setRepliesError(null);
    startTransition(async () => {
      const result = await checkEmailReplies();
      setRepliesPending(false);
      if (result.error) {
        setRepliesError(result.error);
        return;
      }
      setReplies(result.replies);
      setLastCheckInfo(
        result.matched.length > 0
          ? `${result.matched.length} nouvelle${result.matched.length > 1 ? "s" : ""} réponse${result.matched.length > 1 ? "s" : ""}${
              result.unmatchedCount > 0 ? ` (${result.unmatchedCount} email(s) d'expéditeur inconnu ignoré(s))` : ""
            }.`
          : "Aucune nouvelle réponse."
      );
      if (result.matched.length > 0) router.refresh();
    });
  }

  function clearReplies() {
    setReplies([]);
    setLastCheckInfo(null);
    startTransition(async () => {
      await clearUnreviewedReplies();
    });
  }

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedWithEmail = selectedRows.filter((r) => r.figurants?.email && r.figurant_id);
  const selectedWithoutEmail = selectedRows.length - selectedWithEmail.length;
  // La convocation ne repart pas toute seule à quelqu'un qui l'a déjà
  // reçue — il faut d'abord réinitialiser explicitement son envoi.
  const convocationAEnvoyer = selectedWithEmail.filter((r) => !r.convocation_envoyee);
  const convocationDejaEnvoyee = selectedWithEmail.filter((r) => r.convocation_envoyee);

  function convocationFor(r: Row) {
    return buildConvocationMailto({
      figurantPrenom: r.figurants!.prenom,
      figurantEmail: r.figurants!.email!,
      date: r.date,
      heureConvocation: r.heure_convocation,
      fonction: r.fonction,
      lieu: journeeLieu || r.projets?.lieu || null,
      projetNom: r.projets?.nom ?? "",
      confidentiel: r.projets?.confidentiel ?? false,
      nomCode: r.projets?.nom_code ?? null,
      signature: r.projets?.signature ?? null,
      covoiturageInfo: covoiturageReminderLine(r, rows),
      numeroCostume: r.numeroCostume ?? null,
      convocationSettings,
    });
  }

  function openConvocationConfirm() {
    if (selected.size === 0) return;
    setSendResult(null);
    setMessageMode("convocation-confirm");
  }

  function openLibreCompose() {
    if (selected.size === 0) return;
    setSendResult(null);
    setLibreSubject(`Message – ${date ?? ""}`);
    setLibreMessage(DEFAULT_LIBRE_BODY);
    setMessageMode("libre-compose");
  }

  function applyLibreTemplate(template?: MessageTemplate) {
    setLibreSubject(template ? template.sujet : `Message – ${date ?? ""}`);
    setLibreMessage(template ? template.corps : DEFAULT_LIBRE_BODY);
  }

  function cancelMessageComposer() {
    setMessageMode("none");
    setSendResult(null);
  }

  function confirmSendConvocation() {
    if (convocationAEnvoyer.length === 0) return;
    setSendPending(true);
    setSendResult(null);
    startTransition(async () => {
      const result = await sendBulkConvocations(
        convocationAEnvoyer.map((r) => {
          const { subject, body } = convocationFor(r);
          return { bookingId: r.id, figurantId: r.figurant_id!, email: r.figurants!.email!, corps: body, subject };
        }),
        projetId
      );
      setSendPending(false);
      setSendResult(result);
      if (result.failed === 0) {
        setSelected(new Set());
        setMessageMode("none");
      }
      router.refresh();
    });
  }

  function reinitialiserConvocation(ids: string[]) {
    if (ids.length === 0) return;
    startTransition(async () => {
      await resetConvocationEnvoyee(ids);
      router.refresh();
    });
  }

  function confirmSendLibre() {
    if (selectedWithEmail.length === 0 || !libreMessage.trim()) return;
    setSendPending(true);
    setSendResult(null);
    startTransition(async () => {
      let sent = 0;
      let failed = 0;
      for (const r of selectedWithEmail) {
        const tokens = rowTokens(r, journeeLieu);
        const subject = substituteTokens(libreSubject, tokens);
        const body = substituteTokens(libreMessage, tokens);
        const result = await recordBookingMessage(r.figurant_id!, body, r.figurants!.email, subject, projetId);
        if (result?.error) failed += 1;
        else sent += 1;
      }
      setSendPending(false);
      setSendResult({ sent, failed });
      if (failed === 0) {
        setSelected(new Set());
        setMessageMode("none");
      }
      router.refresh();
    });
  }

  async function copyConvocationText(r: Row) {
    if (!r.figurants) return;
    const text = buildConvocationMailto({
      figurantPrenom: r.figurants.prenom,
      figurantEmail: r.figurants.email ?? "convocation@booking-extras.local",
      date: r.date,
      heureConvocation: r.heure_convocation,
      fonction: r.fonction,
      lieu: journeeLieu || r.projets?.lieu || null,
      projetNom: r.projets?.nom ?? "",
      confidentiel: r.projets?.confidentiel ?? false,
      nomCode: r.projets?.nom_code ?? null,
      signature: r.projets?.signature ?? null,
      covoiturageInfo: covoiturageReminderLine(r, rows),
      numeroCostume: r.numeroCostume ?? null,
      convocationSettings,
    }).body;
    await copyTextToClipboard(text);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId((id) => (id === r.id ? null : id)), 1500);
  }

  async function copyEmail(email: string, key: string) {
    await copyTextToClipboard(email);
    setCopiedId(key);
    setTimeout(() => setCopiedId((id) => (id === key ? null : id)), 1500);
  }

  function updateRow(id: string, changes: RowChanges) {
    setRowError(null);
    startTransition(async () => {
      const result = await bulkUpdateBookings([id], changes);
      if (result.error) {
        setRowError({ id, message: result.error });
      } else {
        router.refresh();
      }
    });
  }

  function renderContactLinks(r: Row) {
    if (!r.figurants?.email && !r.figurants?.telephone) return null;
    const emailKey = `email-${r.id}`;
    return (
      <div className="flex flex-col gap-0.5 text-[10px]">
        {r.figurants?.email && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copyEmail(r.figurants!.email!, emailKey);
            }}
            title="Copier pour coller dans la recherche Mail"
            className="w-fit truncate text-left text-coral hover:underline"
          >
            {copiedId === emailKey ? "Copié !" : r.figurants.email}
          </button>
        )}
        {r.figurants?.telephone && (
          <a
            href={smsConversationHref(r.figurants.telephone)}
            onClick={(e) => e.stopPropagation()}
            className="truncate text-coral hover:underline"
          >
            {r.figurants.telephone}
          </a>
        )}
      </div>
    );
  }

  function renderMessageHistory(r: Row) {
    const msgs = messagesByFigurant[r.figurant_id ?? ""] ?? [];
    if (msgs.length === 0) return null;
    const expanded = expandedMessages.has(r.id);
    // La couleur ne bouge que pour la convocation (reponse_recue) — les
    // autres messages restent visibles mais neutres, pas de code couleur.
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => toggleMessagesExpanded(r.id)}
          className={cn(
            "w-fit text-left text-[10px] font-medium hover:underline",
            r.reponse_recue ? "text-turquoise" : "text-coral"
          )}
        >
          {expanded ? "Masquer les messages" : `${msgs.length} message${msgs.length > 1 ? "s" : ""} ▾`}
        </button>
        {expanded && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-ink p-1.5">
            {msgs.map((m) =>
              m.sender === "figurant" ? (
                <div key={m.id} className="rounded-md border-l-2 border-turquoise bg-turquoise/10 px-1.5 py-1 text-[10px]">
                  <div className="font-medium text-turquoise">Eux · {formatMessageDateTime(m.created_at)}</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-text">{m.corps}</p>
                </div>
              ) : (
                <label key={m.id} className="flex items-start gap-1.5 text-[10px]">
                  <input
                    type="checkbox"
                    checked={m.repondu}
                    disabled={pending}
                    onChange={(e) => toggleRepondu(m.id, e.target.checked)}
                    className="mt-0.5 h-3 w-3 shrink-0 rounded border-border accent-yellow"
                    title="A répondu à ce message"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-text-muted">
                      {FIGURANT_MESSAGE_CATEGORIES.find((c) => c.value === m.categorie)?.label ?? m.categorie}
                    </span>
                    {" · "}
                    {formatMessageDateTime(m.created_at)}
                    {m.sujet && <> — « {m.sujet} »</>}
                  </span>
                </label>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  function renderRow(r: Row) {
    const rowDelai = convocationDelai(r, now);
    return (
      <tr
        key={r.id}
        className={cn(
          "border-b border-border last:border-0 hover:bg-ink-raised-2",
          r.statut === "confirmé" && "border-l-2 border-l-turquoise",
          r.reponse_recue && "bg-yellow-fluo/30 border-l-4 border-l-yellow-fluo"
        )}
      >
        <td className="px-4 py-4 align-middle">
          <input
            type="checkbox"
            checked={selected.has(r.id)}
            onChange={() => toggle(r.id)}
            className="h-4 w-4 rounded border-border accent-coral"
          />
        </td>
        <td className="px-4 py-4 align-middle">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
            {r.portraitUrl && (
              <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />
            )}
          </div>
        </td>
        <td className="px-6 py-4 align-middle">
          <Link href={`/bookings/${r.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium hover:text-coral">
            <span className="min-w-0 max-w-full truncate">
              {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
            </span>
            {r.raccord && <RaccordBadge expanded={expandedRaccord.has(r.id)} onToggle={() => toggleRaccordExpanded(r.id)} />}
            {r.reponse_recue && (
              <Badge tone="yellow" title="A répondu à la convocation (BIEN REÇU)">
                ✓ Répondu
              </Badge>
            )}
            {r.essaiOk && <Badge tone="turquoise">Essai OK</Badge>}
            {r.numeroCostume && <Badge tone="coral">Costume {r.numeroCostume}</Badge>}
            {r.indispoMotif !== undefined && (
              <Badge tone="danger" title={r.indispoMotif ? `Indisponible déclaré·e : ${r.indispoMotif}` : "Indisponible déclaré·e"}>
                ⚠ Indispo
              </Badge>
            )}
            {(r.indemnites ?? []).map((ind) => (
              <Badge key={ind.id} tone="yellow" title={`${ind.montant.toFixed(2)} €`}>
                {ind.label}
              </Badge>
            ))}
            {(r.majorations ?? []).map((m) => (
              <Badge key={m.id} tone="turquoise" title={formatMajorationValeur(m)}>
                {m.label}
              </Badge>
            ))}
          </Link>
          <div className="truncate text-xs text-text-muted">{r.figurants?.ville}</div>
          {rowDelai && (
            <div className={cn("text-[10px]", rowDelai.muted ? "text-yellow" : "text-turquoise")}>{rowDelai.text}</div>
          )}
          {renderContactLinks(r)}
          {expandedRaccord.has(r.id) && <RaccordDatesList dates={r.autresDates ?? []} />}
        </td>
        <td className="px-6 py-4 align-middle">
          <input
            type="time"
            defaultValue={r.heure_convocation ? r.heure_convocation.slice(0, 5) : ""}
            disabled={pending}
            className={fieldClass}
            onBlur={(e) => {
              const value = e.target.value || null;
              if (value !== r.heure_convocation) updateRow(r.id, { heure_convocation: value });
            }}
          />
        </td>
        <td className="px-6 py-4 align-middle">
          <input
            list="fonctions-suggestions"
            defaultValue={r.fonction ?? ""}
            disabled={pending}
            placeholder="Passant..."
            className={fieldClass}
            onBlur={(e) => {
              const value = e.target.value.trim() || null;
              if (value !== r.fonction) updateRow(r.id, { fonction: value });
            }}
          />
        </td>
        <td className="px-6 py-4 align-middle">
          <select
            value={r.cachet ?? ""}
            disabled={pending}
            className={fieldClass}
            onChange={(e) => updateRow(r.id, { cachet: e.target.value || null })}
          >
            <option value=""></option>
            {CACHETS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </td>
        <td className="px-6 py-4 align-middle">
          <StatusSelect
            tone={STATUTS.find((s) => s.value === r.statut)?.tone ?? "default"}
            value={r.statut}
            disabled={pending}
            onChange={(e) => updateRow(r.id, { statut: e.target.value as BookingStatut })}
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </StatusSelect>
          {rowError?.id === r.id && <p className="mt-1 text-xs text-danger">{rowError.message}</p>}
        </td>
        <td className="px-6 py-4 align-middle">
          <div className="flex flex-col gap-2">
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
                onChange={(e) => updateRow(r.id, { reponse_recue: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-yellow"
              />
              Répondu
            </label>
            <input
              defaultValue={r.notes ?? ""}
              placeholder="Note..."
              disabled={pending}
              className={fieldClass}
              onBlur={(e) => {
                const value = e.target.value.trim() || null;
                if (value !== r.notes) updateRow(r.id, { notes: value });
              }}
            />
            {r.figurants && (
              <button
                type="button"
                onClick={() => copyConvocationText(r)}
                className="w-fit rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-muted hover:border-coral/60 hover:text-text"
              >
                {copiedId === r.id ? "Copié !" : "Copier (SMS)"}
              </button>
            )}
            {renderMessageHistory(r)}
          </div>
        </td>
      </tr>
    );
  }

  function renderTrombiCard(r: Row) {
    const cardDelai = convocationDelai(r, now);
    return (
      <div
        key={r.id}
        className={cn(
          "relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
          r.reponse_recue
            ? "border-yellow-fluo bg-yellow-fluo/30 hover:border-yellow-fluo"
            : r.statut === "confirmé"
              ? "border-turquoise/40 bg-turquoise/10 hover:border-turquoise/60"
              : "border-border bg-ink-raised hover:border-coral/60"
        )}
      >
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggle(r.id)}
          className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-border accent-coral"
        />
        <Link href={`/bookings/${r.id}`} className="flex w-full flex-col items-center gap-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
            {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
            {r.raccord && (
              <span className="absolute right-1 top-1 z-10">
                <RaccordBadge expanded={expandedRaccord.has(r.id)} onToggle={() => toggleRaccordExpanded(r.id)} />
              </span>
            )}
          </div>
          <div className="text-sm font-medium">
            {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
          </div>
          <label
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="A répondu à la convocation (BIEN REÇU)"
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              r.reponse_recue ? "bg-yellow/15 text-yellow" : "bg-ink-raised-2 text-text-muted"
            )}
          >
            <input
              type="checkbox"
              checked={r.reponse_recue}
              disabled={pending}
              onChange={(e) => updateRow(r.id, { reponse_recue: e.target.checked })}
              className="h-3 w-3 rounded border-border accent-yellow"
            />
            {r.reponse_recue ? "✓ Répondu" : "Répondu"}
          </label>
          {cardDelai && (
            <div className={cn("text-[10px]", cardDelai.muted ? "text-yellow" : "text-turquoise")}>{cardDelai.text}</div>
          )}
          {r.essaiOk && <Badge tone="turquoise">Essai OK</Badge>}
          {r.indispoMotif !== undefined && (
            <Badge tone="danger" title={r.indispoMotif ? `Indisponible déclaré·e : ${r.indispoMotif}` : "Indisponible déclaré·e"}>
              ⚠ Indispo
            </Badge>
          )}
          {(r.indemnites ?? []).map((ind) => (
            <Badge key={ind.id} tone="yellow" title={`${ind.montant.toFixed(2)} €`}>
              {ind.label}
            </Badge>
          ))}
          {(r.majorations ?? []).map((m) => (
            <Badge key={m.id} tone="turquoise" title={formatMajorationValeur(m)}>
              {m.label}
            </Badge>
          ))}
        </Link>
        {expandedRaccord.has(r.id) && <RaccordDatesList dates={r.autresDates ?? []} />}
        {renderContactLinks(r)}
        <input
          list="fonctions-suggestions"
          defaultValue={r.fonction ?? ""}
          disabled={pending}
          placeholder="Fonction..."
          className={cn(fieldClass, "text-center")}
          onBlur={(e) => {
            const value = e.target.value.trim() || null;
            if (value !== r.fonction) updateRow(r.id, { fonction: value });
          }}
        />
        <select
          value={r.cachet ?? ""}
          disabled={pending}
          className={cn(fieldClass, "text-center")}
          onChange={(e) => updateRow(r.id, { cachet: e.target.value || null })}
        >
          <option value="">Cachet...</option>
          {CACHETS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="time"
          defaultValue={r.heure_convocation ? r.heure_convocation.slice(0, 5) : ""}
          disabled={pending}
          className={cn(fieldClass, "text-center")}
          onBlur={(e) => {
            const value = e.target.value || null;
            if (value !== r.heure_convocation) updateRow(r.id, { heure_convocation: value });
          }}
        />
        <StatusSelect
          tone={STATUTS.find((s) => s.value === r.statut)?.tone ?? "default"}
          value={r.statut}
          disabled={pending}
          onChange={(e) => updateRow(r.id, { statut: e.target.value as BookingStatut })}
          className="w-full"
        >
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </StatusSelect>
        {r.figurants && (
          <button
            type="button"
            onClick={() => copyConvocationText(r)}
            className="w-full truncate rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted hover:border-coral/60 hover:text-text"
          >
            {copiedId === r.id ? "Copié !" : "Copier (SMS)"}
          </button>
        )}
        {renderMessageHistory(r)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <datalist id="fonctions-suggestions">
        {fonctions.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {activeRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              "flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold",
              reponduCount === activeRows.length
                ? "border-yellow-fluo bg-yellow-fluo/40 text-text"
                : "border-border bg-ink-raised text-text-muted"
            )}
          >
            {reponduCount}/{activeRows.length} ont répondu à la convocation (BIEN REÇU)
          </div>
          {nonRepondusCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyNonRepondus((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                onlyNonRepondus
                  ? "border-danger bg-danger/15 text-danger"
                  : "border-border text-text-muted hover:text-text"
              )}
            >
              {onlyNonRepondus ? "Voir tout le monde" : `Voir les ${nonRepondusCount} non-répondu${nonRepondusCount > 1 ? "s" : ""}`}
            </button>
          )}
          <Button type="button" variant="ghost" disabled={repliesPending} onClick={checkReplies}>
            {repliesPending ? "Vérification..." : "Vérifier les réponses"}
          </Button>
        </div>
      )}

      {(repliesError || lastCheckInfo || replies.length > 0) && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-ink-raised px-4 py-3">
          {repliesError && <p className="text-sm text-danger">Échec de la vérification : {repliesError}</p>}
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {lastCheckInfo}
              {replies.length > 0 && (
                <span className={lastCheckInfo ? "ml-2 text-text-muted" : ""}>
                  {replies.length} réponse{replies.length > 1 ? "s" : ""} à traiter.
                </span>
              )}
            </span>
            {replies.length > 0 && (
              <button type="button" onClick={clearReplies} className="text-xs text-text-muted hover:text-coral">
                Effacer la liste
              </button>
            )}
          </div>
          {replies.length > 0 && (
            <div className="flex flex-col gap-1">
              {replies.map((r) => (
                <Link
                  key={r.messageId}
                  href={`/figurants/${r.figurantId}`}
                  className="flex flex-wrap items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-ink-raised-2"
                >
                  <span className="shrink-0 font-medium">{r.prenom} {r.nom}</span>
                  {r.sentiment === "positif" && <Badge tone="turquoise">Semble positif</Badge>}
                  {r.sentiment === "negatif" && <Badge tone="danger">Semble négatif</Badge>}
                  {r.sujet && <span className="shrink-0 font-medium text-text-muted">« {r.sujet} »</span>}
                  <span className="truncate text-text-muted">{r.corps.slice(0, 120)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Vue :</span>
        {[
          { value: "liste" as const, label: "Liste" },
          { value: "trombi" as const, label: "Trombinoscope" },
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
        {projetId && date && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-text-muted">
              {selected.size > 0 ? `Trombis / Fiches (${selected.size} sélectionné${selected.size > 1 ? "s" : ""})` : "Trombis / Fiches (tous)"}
            </span>
            <Link
              href={documentHref("trombis")}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
            >
              Trombis
            </Link>
            <Link
              href={documentHref("fiches")}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
            >
              Fiches mensuration
            </Link>
          </div>
        )}
        {filteredRows.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className={cn(
              "rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text",
              !(projetId && date) && "ml-auto"
            )}
          >
            {selected.size === filteredRows.length ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Grouper par :</span>
        {GROUP_DIMENSIONS.map((g) => {
          const idx = groupDims.indexOf(g.key);
          const active = idx !== -1;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() =>
                setGroupDims((prev) => (active ? prev.filter((d) => d !== g.key) : [...prev, g.key]))
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-yellow bg-yellow/15 text-yellow"
                  : "border-border text-text-muted hover:text-text"
              )}
            >
              {active ? `${idx + 1}. ` : ""}
              {g.label}
            </button>
          );
        })}
        {groupDims.length > 0 && (
          <button
            type="button"
            onClick={() => setGroupDims([])}
            className="text-xs text-text-muted hover:text-text hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Filtrer fonction :</span>
        <button
          type="button"
          onClick={() => setActiveFonction(null)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !activeFonction ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          Toutes
        </button>
        {fonctions.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFonction((prev) => (prev === f ? null : f))}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeFonction === f
                ? "border-coral bg-coral/15 text-coral"
                : "border-border text-text-muted hover:text-text"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Filtrer cachet :</span>
        <button
          type="button"
          onClick={() => setActiveCachet(null)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !activeCachet ? "border-turquoise bg-turquoise/15 text-turquoise" : "border-border text-text-muted hover:text-text"
          )}
        >
          Tous
        </button>
        {CACHETS.map((c) => {
          const count = cachetCounts.get(c) ?? 0;
          return (
            <button
              key={c}
              type="button"
              disabled={count === 0}
              onClick={() => setActiveCachet((prev) => (prev === c ? null : c))}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-30",
                activeCachet === c
                  ? "border-turquoise bg-turquoise/15 text-turquoise"
                  : "border-border text-text-muted hover:text-text"
              )}
            >
              {c} ({count})
            </button>
          );
        })}
      </div>


      {hiddenIds.size > 0 && (
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{hiddenIds.size} masqué{hiddenIds.size > 1 ? "s" : ""}</span>
          <button type="button" onClick={() => setHiddenIds(new Set())} className="text-coral hover:underline">
            Tout réafficher
          </button>
        </div>
      )}

      {archivedCount > 0 && (
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>
            {archivedCount} indisponible{archivedCount > 1 ? "s" : ""}/annulé{archivedCount > 1 ? "s" : ""} masqué
            {archivedCount > 1 ? "s" : ""} (contacté{archivedCount > 1 ? "s" : ""} précédemment)
          </span>
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-coral hover:underline">
            {showArchived ? "Masquer à nouveau" : "Afficher"}
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <span className="text-sm">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <select
            onChange={(e) => {
              applyBulkStatut(e.target.value);
              e.target.value = "";
            }}
            disabled={pending}
            defaultValue=""
            className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
          >
            <option value="" disabled>
              {pending ? "Mise à jour..." : "Marquer statut..."}
            </option>
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                Marquer {s.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              list="fonctions-suggestions"
              value={bulkFonction}
              onChange={(e) => setBulkFonction(e.target.value)}
              placeholder="Fonction..."
              disabled={pending}
              className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
            />
            <Button type="button" variant="secondary" disabled={pending || !bulkFonction.trim()} onClick={applyBulkFonction}>
              Appliquer
            </Button>
          </div>
          <select
            onChange={(e) => {
              applyBulkCachet(e.target.value);
              e.target.value = "";
            }}
            disabled={pending}
            defaultValue=""
            className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
          >
            <option value="" disabled>
              {pending ? "Mise à jour..." : "Marquer cachet..."}
            </option>
            {CACHETS.map((c) => (
              <option key={c} value={c}>
                Marquer {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={bulkHeure}
              onChange={(e) => setBulkHeure(e.target.value)}
              disabled={pending}
              className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
            />
            <Button type="button" variant="secondary" disabled={pending || !bulkHeure} onClick={applyBulkHeure}>
              Appliquer l&apos;heure
            </Button>
          </div>
          {(projetIndemnites.length > 0 || baremeMajorations.length > 0) && (
            <select
              onChange={(e) => {
                const [kind, id] = e.target.value.split(":");
                if (kind === "indemnite") applyBulkIndemnite(id);
                else if (kind === "majoration") applyBulkMajoration(id);
                e.target.value = "";
              }}
              disabled={pending}
              defaultValue=""
              className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
            >
              <option value="" disabled>
                {pending ? "Mise à jour..." : "Appliquer une indemnité/majoration..."}
              </option>
              {projetIndemnites.length > 0 && (
                <optgroup label="Indemnités du projet">
                  {projetIndemnites.map((ind) => (
                    <option key={ind.id} value={`indemnite:${ind.id}`}>
                      {ind.label} ({ind.montant.toFixed(2)} €)
                    </option>
                  ))}
                </optgroup>
              )}
              {baremeMajorations.length > 0 && (
                <optgroup label="Majorations barème">
                  {baremeMajorations.map((m) => (
                    <option key={m.id} value={`majoration:${m.id}`}>
                      {m.label} ({formatMajorationValeur(m)})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
          <Button type="button" variant="secondary" disabled={pending || sendPending} onClick={openConvocationConfirm}>
            Convocation
          </Button>
          <Button type="button" variant="secondary" disabled={pending || sendPending} onClick={openLibreCompose}>
            Message libre
          </Button>
          {projetId && (
            <Button type="button" variant="turquoise" disabled={pending} onClick={() => setEssayageOpen((v) => !v)}>
              Envoyer à un essayage
            </Button>
          )}
          {projetId && (
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setAddDatesOpen((v) => !v)}>
              + Ajouter des dates
            </Button>
          )}
          {projetId && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setEspacePersoResult(null);
                setEspacePersoOpen((v) => !v);
              }}
            >
              Lien espace perso
            </Button>
          )}
          <Button type="button" variant="ghost" disabled={pending} onClick={hideSelection}>
            Masquer la sélection
          </Button>
          {addDatesOpen && projetId && (
            <div className="w-full border-t border-turquoise/40 pt-3">
              <AddToJourneeBar
                figurantIds={selectedRows.map((r) => r.figurant_id).filter((id): id is string => !!id)}
                projets={[{ id: projetId, nom: rows[0]?.projets?.nom ?? "Ce projet" }]}
                onDone={() => {
                  setAddDatesOpen(false);
                  setSelected(new Set());
                }}
              />
            </div>
          )}
          {essayageOpen && projetId && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-turquoise/40 pt-3">
              <input
                type="date"
                value={essayageDate}
                onChange={(e) => setEssayageDate(e.target.value)}
                disabled={pending}
                className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
              />
              <input
                value={essayageLieu}
                onChange={(e) => setEssayageLieu(e.target.value)}
                placeholder="Lieu (optionnel)"
                disabled={pending}
                className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
              />
              <Button type="button" variant="turquoise" disabled={pending || !essayageDate} onClick={sendToEssayage}>
                {pending ? "Envoi..." : "Envoyer"}
              </Button>
              {essayageResult && <span className="text-xs text-text-muted">{essayageResult}</span>}
            </div>
          )}

          {espacePersoOpen && projetId && (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-turquoise/40 pt-3">
              <span className="text-sm">
                Envoyer le lien d&apos;espace perso à {selectedWithEmail.length} personne
                {selectedWithEmail.length > 1 ? "s" : ""}
                {selectedWithoutEmail > 0 && (
                  <span className="ml-2 text-xs text-danger">
                    ({selectedWithoutEmail} sans email, ignoré{selectedWithoutEmail > 1 ? "s" : ""})
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="turquoise"
                disabled={pending || selectedWithEmail.length === 0}
                onClick={sendEspacePerso}
              >
                {pending ? "Envoi..." : "Envoyer"}
              </Button>
              {espacePersoResult && (
                <span className="text-xs text-text-muted">
                  {espacePersoResult.sent} envoyé{espacePersoResult.sent > 1 ? "s" : ""}
                  {espacePersoResult.failed > 0 ? `, ${espacePersoResult.failed} échec(s)` : ""}.
                </span>
              )}
            </div>
          )}

          {messageMode === "convocation-confirm" && (
            <div className="flex w-full flex-col gap-3 border-t border-coral/40 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Envoyer la convocation par email à {convocationAEnvoyer.length} personne
                  {convocationAEnvoyer.length > 1 ? "s" : ""}
                  {selectedWithoutEmail > 0 && (
                    <span className="ml-2 text-xs text-danger">
                      ({selectedWithoutEmail} sans email, ignoré{selectedWithoutEmail > 1 ? "s" : ""})
                    </span>
                  )}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-ink p-2 text-xs">
                {convocationAEnvoyer.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 py-0.5">
                    <span>{r.figurants?.prenom} {r.figurants?.nom}</span>
                    <span className="text-text-muted">
                      {r.heure_convocation ? r.heure_convocation.slice(0, 5) : "heure à confirmer"}
                    </span>
                  </div>
                ))}
                {convocationAEnvoyer.length === 0 && (
                  <p className="text-text-muted">Personne à convoquer dans la sélection.</p>
                )}
              </div>
              {convocationDejaEnvoyee.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-lg border border-yellow/40 bg-yellow/10 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-yellow">
                      {convocationDejaEnvoyee.length} déjà convoqué{convocationDejaEnvoyee.length > 1 ? "s" : ""} — ne{" "}
                      {convocationDejaEnvoyee.length > 1 ? "seront" : "sera"} pas renvoyé
                      {convocationDejaEnvoyee.length > 1 ? "s" : ""}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => reinitialiserConvocation(convocationDejaEnvoyee.map((r) => r.id))}
                      className="text-coral hover:underline disabled:opacity-60"
                    >
                      Réinitialiser leur envoi
                    </button>
                  </div>
                  {convocationDejaEnvoyee.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-text-muted">
                      <span>{r.figurants?.prenom} {r.figurants?.nom}</span>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => reinitialiserConvocation([r.id])}
                        className="text-coral hover:underline disabled:opacity-60"
                      >
                        Réinitialiser
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {sendResult && (
                <p className="text-xs text-text-muted">
                  {sendResult.sent} envoyé{sendResult.sent > 1 ? "s" : ""}
                  {sendResult.failed > 0 ? `, ${sendResult.failed} échec(s)` : ""}.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={sendPending} onClick={cancelMessageComposer}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  disabled={sendPending || convocationAEnvoyer.length === 0}
                  onClick={confirmSendConvocation}
                >
                  {sendPending ? "Envoi..." : `Confirmer et envoyer (${convocationAEnvoyer.length})`}
                </Button>
              </div>
            </div>
          )}

          {(messageMode === "libre-compose" || messageMode === "libre-confirm") && (
            <div className="flex w-full flex-col gap-3 border-t border-coral/40 pt-3">
              <span className="text-sm font-medium">
                Message libre pour {selectedWithEmail.length} personne{selectedWithEmail.length > 1 ? "s" : ""}
                {selectedWithoutEmail > 0 && (
                  <span className="ml-2 text-xs text-danger">
                    ({selectedWithoutEmail} sans email, ignoré{selectedWithoutEmail > 1 ? "s" : ""})
                  </span>
                )}
              </span>

              {messageMode === "libre-compose" && (
                <>
                  {templates.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-text-muted">Modèle :</span>
                      <button
                        type="button"
                        onClick={() => applyLibreTemplate()}
                        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:text-text"
                      >
                        Vierge
                      </button>
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyLibreTemplate(t)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
                        >
                          {t.nom}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input value={libreSubject} onChange={(e) => setLibreSubject(e.target.value)} placeholder="Sujet" />
                  <textarea
                    value={libreMessage}
                    onChange={(e) => setLibreMessage(e.target.value)}
                    placeholder="Votre message"
                    rows={4}
                    className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={cancelMessageComposer}>
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      disabled={!libreMessage.trim() || selectedWithEmail.length === 0}
                      onClick={() => setMessageMode("libre-confirm")}
                    >
                      Prévisualiser ({selectedWithEmail.length})
                    </Button>
                  </div>
                </>
              )}

              {messageMode === "libre-confirm" && (
                <>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-ink p-2 text-xs">
                    {selectedWithEmail.map((r) => (
                      <div key={r.id} className="py-0.5">
                        {r.figurants?.prenom} {r.figurants?.nom}
                      </div>
                    ))}
                  </div>
                  {sendResult && (
                    <p className="text-xs text-text-muted">
                      {sendResult.sent} envoyé{sendResult.sent > 1 ? "s" : ""}
                      {sendResult.failed > 0 ? `, ${sendResult.failed} échec(s)` : ""}.
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={sendPending}
                      onClick={() => setMessageMode("libre-compose")}
                    >
                      Retour
                    </Button>
                    <Button type="button" disabled={sendPending} onClick={confirmSendLibre}>
                      {sendPending ? "Envoi..." : `Confirmer et envoyer (${selectedWithEmail.length})`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === "liste" && (
      <div className="overflow-x-auto rounded-2xl border border-border bg-ink-raised">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === filteredRows.length && filteredRows.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border accent-coral"
                />
              </th>
              <th className="w-14 px-4 py-3"></th>
              <th className="w-48 px-6 py-3 font-medium">Figurant</th>
              <th className="w-24 px-6 py-3 font-medium">Heure</th>
              <th className="w-32 px-6 py-3 font-medium">Fonction</th>
              <th className="w-36 px-6 py-3 font-medium">Cachet</th>
              <th className="w-44 px-6 py-3 font-medium">Statut</th>
              <th className="w-40 px-6 py-3 font-medium">Suivi</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.label ?? "__all__"}>
                {group.label !== null && (
                  <tr key={`group-${group.label}`} className="bg-ink-raised-2/60">
                    <td colSpan={8} className="px-6 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                      <div className="flex items-center gap-3">
                        <span>
                          {group.label} ({group.rows.length})
                          <span className="normal-case text-text-muted/70">{repondusSuffix(group.rows)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.rows)}
                          className="normal-case text-coral hover:underline"
                        >
                          {group.rows.every((r) => selected.has(r.id)) ? "Désélectionner" : "Sélectionner le groupe"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {group.rows.map(renderRow)}
              </Fragment>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-text-muted">
                  Aucun booking pour ce filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {viewMode === "trombi" && (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.label ?? "__all__"} className="flex flex-col gap-3">
              {group.label !== null && (
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {group.label} ({group.rows.length})
                    <span className="normal-case text-text-muted/70">{repondusSuffix(group.rows)}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.rows)}
                    className="text-xs text-coral hover:underline"
                  >
                    {group.rows.every((r) => selected.has(r.id)) ? "Désélectionner" : "Sélectionner le groupe"}
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {[...group.rows]
                  .sort((a, b) => (a.figurants?.nom ?? "").localeCompare(b.figurants?.nom ?? ""))
                  .map(renderTrombiCard)}
              </div>
            </div>
          ))}
          {filteredRows.length === 0 && (
            <p className="py-10 text-center text-text-muted">Aucun booking pour ce filtre.</p>
          )}
        </div>
      )}
    </div>
  );
}
