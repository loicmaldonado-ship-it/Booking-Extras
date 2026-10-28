"use client";

import { nomComplet, formatPrenom, comparerNoms } from "@/lib/noms";
import { PhotosTrombiPicker } from "@/components/bookings/photos-trombi-picker";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "@/components/ui/image";
import { ZoomableImage, ZoomButton } from "@/components/ui/zoomable-image";
import { StatusSelect } from "@/components/ui/status-select";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modale } from "@/components/ui/modale";
import { EnvoyerTextos } from "@/components/textos/envoyer-textos";
import { enregistrerDernierMessage, lireDernierMessage } from "@/lib/messages/derniers-actions";
import { cn } from "@/lib/cn";
import {
  bulkUpdateBookings,
  recordBookingMessage,
  sendBulkConvocations,
  sendEspacePersoLinkBulk,
  resetConvocationEnvoyee,
  retirerBookings,
} from "@/lib/bookings/actions";
import { applyIndemniteToBookings } from "@/lib/indemnites/actions";
import type { ProjetIndemnite } from "@/lib/indemnites/types";
import { applyMajorationToBookings } from "@/lib/bareme/actions";
import { formatMajorationValeur, type BaremeMajoration, type MajorationValeurType } from "@/lib/bareme/types";
import { AddToJourneeBar } from "@/components/bookings/add-to-journee-bar";
import { ChangeDateBar } from "@/components/bookings/change-date-bar";
import { mettreBookingsEnReserve } from "@/lib/reserve/actions";
import { AddToCastingBar } from "@/components/casting/add-to-casting-bar";
import { checkEmailReplies, clearUnreviewedReplies } from "@/lib/bookings/inbox-actions";
import { sendFigurantsToEssayage } from "@/lib/essayages/actions";
import { toggleMessageRepondu } from "@/lib/figurants/messages-actions";
import type { InboxReply } from "@/lib/email/inbox";
import { STATUTS, type BookingStatut, type CovoiturageRole } from "@/lib/bookings/types";
import { CACHETS } from "@/lib/candidatures/types";
import { computeAge } from "@/lib/documents/fields";
import { buildConvocationMailto, substituteTokens, type ConvocationSettings } from "@/lib/bookings/convocation";
import { projetNomPublic } from "@/lib/projets/types";
import { ContactIcons } from "@/components/ui/contact-icons";
import { PreviewButton, type PreviewItem } from "@/components/figurants/figurant-preview-modal";
import { FIGURANT_MESSAGE_CATEGORIES, type FigurantMessageCategorie } from "@/lib/candidats/types";
import { formatDateTime as formatMessageDateTime, formatDelai, formatDateLong } from "@/lib/format-date";
import type { Genre, PhotoType } from "@/lib/figurants/types";
import { toGalleryPhotos, galleryIndexOfUrl } from "@/lib/figurants/photo-labels";
import { nomModele, type MessageTemplate } from "@/lib/templates/types";

export type MessageRow = {
  id: string;
  sender: "staff" | "figurant";
  categorie: FigurantMessageCategorie;
  sujet: string | null;
  corps: string;
  created_at: string;
  repondu: boolean;
  // Réponse importée d'une boîte Gmail (relève automatique).
  mail_message_id?: string | null;
  lu_gmail_le?: string | null;
  // Membre de l'équipe qui l'a envoyé.
  auteur?: string | null;
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

// Rouvrir la candidature d'origine (message, photos, réponses) dans un
// nouvel onglet, sans quitter la journée.
function LienCandidature({ id }: { id: string }) {
  return (
    <a
      href={`/candidatures/${id}`}
      target="_blank"
      rel="noopener"
      className="rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-text hover:border-coral/60"
      title="Voir sa candidature (message, photos, réponses)"
    >
      📄 Candidature
    </a>
  );
}

// Avis de la MES (🎬) sur un profil de la journée.
function BadgeMesBooking({ mes }: { mes: Row["mes"] }) {
  if (!mes?.vote) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        mes.vote === "oui" ? "bg-turquoise text-white" : mes.vote === "non" ? "bg-danger/15 text-danger" : "bg-yellow/25 text-yellow"
      )}
      title={mes.note ? `${mes.qui} : « ${mes.note} »` : mes.qui}
    >
      🎬 {mes.vote === "oui" ? "Validé MES" : mes.vote === "non" ? "Écarté MES" : "Peut-être MES"}
    </span>
  );
}

export type Row = {
  id: string;
  // Candidature d'origine (annonce de ce projet), pour la rouvrir.
  candidatureId?: string | null;
  // Dernier avis de la MES sur le lien de validation du projet.
  mes?: { vote: "oui" | "peut" | "non" | null; qui: string; note: string } | null;
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
  // Accepté la proposition de booking (case « Répondu booking » → CONFIRMÉ).
  reponse_booking?: boolean;
  notes: string | null;
  covoiturage_role?: CovoiturageRole | null;
  covoiturage_lieu_depart?: string | null;
  covoiturage_conducteur_id?: string | null;
  figurants: {
    prenom: string;
    nom: string;
    ville: string | null;
    code_postal: string | null;
    email: string | null;
    telephone: string | null;
    genre: Genre | null;
    date_naissance: string | null;
    compte_myrole?: boolean;
    a_vehicule?: boolean | null;
    vehicule_velo?: boolean;
    vehicule_moto?: boolean;
    vehicule_scooter?: boolean;
    vehicule_voiture?: boolean;
  } | null;
  projets: { nom: string; confidentiel: boolean; nom_code?: string | null; lieu: string | null; signature: string | null } | null;
  portraitUrl: string | null;
  photos?: { url: string | null; type: PhotoType }[];
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
    return `Rappel covoiturage : vous êtes avec ${nomComplet(chauffeur.figurants)}${tel}. Départ : ${chauffeur.covoiturage_lieu_depart ?? "à confirmer"}.`;
  }
  return null;
}

export function rowTokens(r: Row, journeeLieu?: string | null) {
  // Raccord : le token {date} liste toutes ses dates sur ce projet plutôt
  // que juste celle de cette journée — pour un profil CONFIRMÉ, seulement
  // ses dates confirmées (pas une journée où il est indispo) ; sinon toutes
  // celles encore en cours (ni annulées, ni indispo, ni à rebooker).
  const EXCLUS = new Set(["annulé", "indisponible", "a_rebooker"]);
  const autresDates = (r.autresDates ?? [])
    .filter((d) => (r.statut === "confirmé" ? d.statut === "confirmé" : !EXCLUS.has(d.statut)))
    .map((d) => d.date);
  const allDates = Array.from(new Set([r.date, ...autresDates])).sort();

  return {
    prenom: formatPrenom(r.figurants?.prenom),
    projet: projetNomPublic(r.projets, "notre tournage"),
    date: allDates.map((d) => formatDateLong(d)).join(", "),
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
  reponse_booking: boolean;
  notes: string | null;
}>;
type Dimension = "fonction" | "cachet" | "statut" | "sexe" | "age" | "heure" | "repondu" | "vehicule" | "myrole";

const GROUP_DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "fonction", label: "Fonction" },
  { key: "cachet", label: "Cachet" },
  { key: "statut", label: "Statut" },
  { key: "sexe", label: "Genre" },
  { key: "age", label: "Âge" },
  { key: "heure", label: "Heure" },
  { key: "repondu", label: "Répondu convocation" },
  { key: "vehicule", label: "Véhicule" },
  { key: "myrole", label: "Myrole" },
];

// Dimensions transposables telles quelles vers le tri additif des documents
// (trombis/fiches) — "statut" n'existe pas là-bas, ces docs ne montrant que
// des bookings confirmés.
const DOCUMENT_SORT_DIMENSIONS = new Set<Dimension>(["fonction", "cachet", "sexe", "age", "heure"]);

// Chaque statut a un ton (voir STATUTS) qu'on rend visible directement sur la
// ligne/carte, pas seulement dans la petite pastille du select — pour repérer
// d'un coup d'œil les groupes de statuts (tous les confirmé, etc.) même hors
// tri par statut.
const STATUT_ROW_CLASSES: Record<string, { rowBorderL: string; rowBg: string; cardBorder: string; cardBg: string }> = {
  default: { rowBorderL: "border-l-border", rowBg: "", cardBorder: "border-border", cardBg: "bg-ink-raised" },
  coral: { rowBorderL: "border-l-coral", rowBg: "bg-coral/5", cardBorder: "border-coral/40", cardBg: "bg-coral/10" },
  turquoise: { rowBorderL: "border-l-turquoise", rowBg: "bg-turquoise/5", cardBorder: "border-turquoise/40", cardBg: "bg-turquoise/10" },
  confirme: { rowBorderL: "border-l-turquoise", rowBg: "bg-turquoise/20", cardBorder: "border-turquoise", cardBg: "bg-turquoise/25" },
  yellow: { rowBorderL: "border-l-yellow", rowBg: "bg-yellow/5", cardBorder: "border-yellow/40", cardBg: "bg-yellow/10" },
  danger: { rowBorderL: "border-l-danger", rowBg: "bg-danger/5", cardBorder: "border-danger/40", cardBg: "bg-danger/10" },
  indispo: { rowBorderL: "border-l-danger", rowBg: "bg-danger/20", cardBorder: "border-danger", cardBg: "bg-danger/25" },
  orange: { rowBorderL: "border-l-[#c2410c]", rowBg: "bg-[#c2410c]/10", cardBorder: "border-[#c2410c]", cardBg: "bg-[#c2410c]/15" },
  bleu: { rowBorderL: "border-l-[#1e3a8a]", rowBg: "bg-[#1e3a8a]/10", cardBorder: "border-[#1e3a8a]", cardBg: "bg-[#1e3a8a]/15" },
  rougePale: { rowBorderL: "border-l-[#f4a3a3]", rowBg: "bg-[#fbd5d5]/40", cardBorder: "border-[#f4a3a3]", cardBg: "bg-[#fbd5d5]/50" },
};

function statutRowClasses(statut: BookingStatut) {
  const tone = STATUTS.find((s) => s.value === statut)?.tone ?? "default";
  return STATUT_ROW_CLASSES[tone] ?? STATUT_ROW_CLASSES.default;
}

type Group = { label: string | null; rows: Row[] };

function dimensionLabel(r: Row, dimension: Dimension) {
  if (dimension === "statut") return STATUTS.find((s) => s.value === r.statut)?.label ?? r.statut;
  if (dimension === "fonction") return r.fonction ?? "Sans fonction";
  if (dimension === "cachet") return r.cachet ?? "Sans cachet";
  if (dimension === "sexe") return r.figurants?.genre ?? "Non renseigné";
  if (dimension === "heure") return r.heure_convocation ? r.heure_convocation.slice(0, 5) : "Sans heure";
  if (dimension === "repondu") return r.reponse_recue ? "Répondu convocation" : "Pas répondu convocation";
  if (dimension === "myrole") return r.figurants?.compte_myrole ? "Avec compte Myrole" : "Sans compte Myrole";
  if (dimension === "vehicule") {
    const f = r.figurants;
    if (!f || f.a_vehicule === null || f.a_vehicule === undefined) return "Véhicule non renseigné";
    if (!f.a_vehicule) return "Sans véhicule";
    const types = [f.vehicule_voiture && "Voiture", f.vehicule_velo && "Vélo", f.vehicule_moto && "Moto", f.vehicule_scooter && "Scooter"].filter(
      Boolean
    );
    return types.length > 0 ? types.join(" + ") : "Véhicule (type non précisé)";
  }
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

// « 34 ans · Montreuil » sous le nom, pour voir l'âge d'un coup d'œil.
const NOUVELLE_FONCTION = "__nouvelle__";

// Fonction d'un profil : déroulant qui propose d'abord les besoins de la
// journée (ajoutés au-dessus), puis les autres fonctions du projet, ou une
// nouvelle fonction tapée à la main.
function FonctionSelect({
  value,
  besoins,
  autres,
  onChange,
  disabled,
  className,
  videLabel = "Fonction…",
}: {
  value: string | null;
  besoins: string[];
  autres: string[];
  onChange: (fonction: string | null) => void;
  disabled?: boolean;
  className?: string;
  videLabel?: string;
}) {
  const [saisie, setSaisie] = useState(false);
  // Option correspondante, même si la casse diffère (anciennes saisies).
  const option = value ? [...besoins, ...autres].find((f) => f.toLowerCase() === value.trim().toLowerCase()) : undefined;
  const connue = !value || !!option;

  if (saisie) {
    return (
      <input
        autoFocus
        placeholder="Nouvelle fonction…"
        disabled={disabled}
        className={className}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setSaisie(false);
        }}
        onBlur={(e) => {
          const v = e.target.value.trim();
          setSaisie(false);
          if (v && v !== value) onChange(v);
        }}
      />
    );
  }

  return (
    <select
      value={option ?? value ?? ""}
      disabled={disabled}
      className={className}
      onChange={(e) => {
        if (e.target.value === NOUVELLE_FONCTION) setSaisie(true);
        else onChange(e.target.value || null);
      }}
    >
      <option value="">{videLabel}</option>
      {!connue && value && <option value={value}>{value}</option>}
      {besoins.length > 0 && (
        <optgroup label="Besoins de la journée">
          {besoins.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </optgroup>
      )}
      {autres.length > 0 && (
        <optgroup label={besoins.length > 0 ? "Autres fonctions du projet" : "Fonctions du projet"}>
          {autres.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </optgroup>
      )}
      <option value={NOUVELLE_FONCTION}>➕ Nouvelle fonction…</option>
    </select>
  );
}

// Notes du profil sur ce booking (spécificités, retours…), comme sur les
// cartes de casting : enregistrées en quittant le champ.
function NotesBooking({ r, disabled, onSave }: { r: Row; disabled: boolean; onSave: (notes: string | null) => void }) {
  return (
    <textarea
      defaultValue={r.notes ?? ""}
      placeholder="Notes (spécificités...)"
      rows={2}
      disabled={disabled}
      className="w-full resize-none rounded-lg border border-border bg-ink px-2 py-1.5 text-xs outline-none focus:border-coral disabled:opacity-60"
      onBlur={(e) => {
        const value = e.target.value.trim() || null;
        if (value !== r.notes) onSave(value);
      }}
    />
  );
}

function ageEtVille(r: Row) {
  const age = computeAge(r.figurants?.date_naissance ?? null);
  return [age != null ? `${age} ans` : null, r.figurants?.ville].filter(Boolean).join(" · ");
}

export function BookingsTable({
  rows,
  projetId,
  fonctionsProjet = [],
  besoinsFonctions = [],
  date,
  templates = [],
  journeeLieu = null,
  convocationSettings = null,
  initialReplies = [],
  messagesByFigurant = {},
  projetIndemnites = [],
  baremeMajorations = [],
  autresJournees = [],
}: {
  rows: Row[];
  projetId?: string;
  // Fonctions enregistrées du projet, proposées dans les champs Fonction.
  fonctionsProjet?: string[];
  // Fonctions des besoins de la journée, proposées en premier.
  besoinsFonctions?: string[];
  date?: string;
  templates?: MessageTemplate[];
  journeeLieu?: string | null;
  convocationSettings?: ConvocationSettings | null;
  initialReplies?: InboxReply[];
  messagesByFigurant?: Record<string, MessageRow[]>;
  projetIndemnites?: ProjetIndemnite[];
  baremeMajorations?: BaremeMajoration[];
  // Autres journées du projet, proposées pour "Changer de date".
  autresJournees?: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [resetConvocationError, setResetConvocationError] = useState<string | null>(null);
  const [activeFonction, setActiveFonction] = useState<string | null>(null);
  const [activeCachet, setActiveCachet] = useState<string | null>(null);
  const [groupDims, setGroupDims] = useState<Dimension[]>(["fonction", "cachet"]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [onlyNonRepondus, setOnlyNonRepondus] = useState(false);
  const [bulkStatut, setBulkStatut] = useState("");
  const [bulkFonction, setBulkFonction] = useState("");
  const [bulkCachet, setBulkCachet] = useState("");
  const [bulkHeure, setBulkHeure] = useState("");
  const [viewMode, setViewMode] = useState<"liste" | "trombi">("trombi");
  const [essayageOpen, setEssayageOpen] = useState(false);
  const [castingOpen, setCastingOpen] = useState(false);
  const [addDatesOpen, setAddDatesOpen] = useState(false);
  const [changeDateOpen, setChangeDateOpen] = useState(false);
  const [changeDateMessage, setChangeDateMessage] = useState<string | null>(null);
  const [espacePersoOpen, setEspacePersoOpen] = useState(false);
  // Personnes cochées à l'ouverture d'une fenêtre d'action : elle les garde
  // même quand l'envoi vide la sélection, pour montrer le résultat.
  const [figee, setFigee] = useState<{ bookingIds: string[]; figurantIds: string[] }>({ bookingIds: [], figurantIds: [] });
  const [espacePersoResult, setEspacePersoResult] = useState<{ sent: number; failed: number; dejaCompte?: number } | null>(null);
  const [essayageDate, setEssayageDate] = useState("");
  const [essayageLieu, setEssayageLieu] = useState("");
  const [essayageResult, setEssayageResult] = useState<string | null>(null);
  const [messageMode, setMessageMode] = useState<"none" | "convocation-confirm" | "libre-compose" | "libre-confirm">(
    "none"
  );
  const [libreSubject, setLibreSubject] = useState(`Message – ${date ?? ""}`);
  const [libreMessage, setLibreMessage] = useState(DEFAULT_LIBRE_BODY);
  const [sendPending, setSendPending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped?: number; unmarked?: number } | null>(null);
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

  const fonctions = useMemo(() => {
    const parCle = new Map<string, string>();
    for (const f of [...fonctionsProjet, ...rows.map((r) => r.fonction)]) {
      if (f && !parCle.has(f.trim().toLowerCase())) parCle.set(f.trim().toLowerCase(), f.trim());
    }
    return Array.from(parCle.values()).sort(new Intl.Collator("fr", { sensitivity: "base" }).compare);
  }, [fonctionsProjet, rows]);
  const fonctionsBesoins = useMemo(
    () => [...besoinsFonctions].sort(new Intl.Collator("fr", { sensitivity: "base" }).compare),
    [besoinsFonctions]
  );
  // Filtre : seulement les fonctions de cette journée (profils + besoins),
  // pas toutes celles du projet.
  const fonctionsJournee = useMemo(() => {
    const parCle = new Map<string, string>();
    for (const f of [...rows.map((r) => r.fonction), ...besoinsFonctions]) {
      if (f && !parCle.has(f.trim().toLowerCase())) parCle.set(f.trim().toLowerCase(), f.trim());
    }
    return Array.from(parCle.values()).sort(new Intl.Collator("fr", { sensitivity: "base" }).compare);
  }, [rows, besoinsFonctions]);
  const autresFonctions = useMemo(() => {
    const deja = new Set(besoinsFonctions.map((f) => f.trim().toLowerCase()));
    return fonctions.filter((f) => !deja.has(f.toLowerCase()));
  }, [fonctions, besoinsFonctions]);

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
      (!activeFonction || r.fonction?.trim().toLowerCase() === activeFonction.toLowerCase()) &&
      (!activeCachet || r.cachet === activeCachet) &&
      !hiddenIds.has(r.id) &&
      (showArchived || !STATUTS_ARCHIVES.has(r.statut)) &&
      (!onlyNonRepondus || (r.convocation_envoyee && !r.reponse_recue))
  );

  const groups = useMemo((): Group[] => {
    if (groupDims.length === 0) return [{ label: null, rows: filteredRows }];
    return groupRows(filteredRows, groupDims);
  }, [groupDims, filteredRows]);

  // Aperçu popup (bookings + échanges) — sur le même périmètre déjà filtré
  // (fonction/cachet/statut/répondu) affiché à l'écran, pas sur `rows` en
  // entier.
  const previewItems: PreviewItem[] = filteredRows
    .filter((r) => !!r.figurant_id)
    .map((r) => ({
      id: r.figurant_id!,
      prenom: formatPrenom(r.figurants?.prenom),
      nom: r.figurants?.nom ?? "",
      ville: r.figurants?.ville ?? null,
      portraitUrl: r.portraitUrl,
    }));
  const previewIndexByBookingId = new Map(filteredRows.filter((r) => r.figurant_id).map((r, i) => [r.id, i]));


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

  function applyBulkChanges() {
    if (selected.size === 0 || pending) return;
    setBulkError(null);
    const changes: Parameters<typeof bulkUpdateBookings>[1] = {};
    if (bulkStatut) changes.statut = bulkStatut as BookingStatut;
    if (bulkFonction.trim()) changes.fonction = bulkFonction.trim();
    if (bulkCachet) changes.cachet = bulkCachet;
    if (bulkHeure) changes.heure_convocation = bulkHeure;
    if (Object.keys(changes).length === 0) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      try {
        const result = await bulkUpdateBookings(ids, changes);
        if (result.error) {
          setBulkError(result.error);
          return;
        }
        setSelected(new Set());
        setBulkStatut("");
        setBulkFonction("");
        setBulkCachet("");
        setBulkHeure("");
        router.refresh();
      } catch {
        setBulkError("Mise à jour impossible. Réessaie lorsque la connexion est rétablie.");
      }
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

  function retirerSelection() {
    const cibles = rows.filter((r) => selected.has(r.id));
    if (cibles.length === 0) return;
    const noms = cibles
      .slice(0, 10)
      .map((r) => nomComplet(r.figurants).trim())
      .join(", ");
    const suite = cibles.length > 10 ? ` et ${cibles.length - 10} autre${cibles.length - 10 > 1 ? "s" : ""}` : "";
    if (!confirm(`Retirer de la journée : ${noms}${suite} ?\n\n${cibles.length > 1 ? "Leurs bookings sont supprimés" : "Son booking est supprimé"} (aucun message n'est envoyé).`)) return;
    startTransition(async () => {
      const res = await retirerBookings(cibles.map((r) => r.id));
      if (res.error) {
        alert(res.error);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  // Met la sélection de côté : retirés de la journée, ils rejoignent la
  // Réserve du projet (page Bookings), avec leur candidature d'origine.
  function mettreEnReserve() {
    const cibles = rows.filter((r) => selected.has(r.id));
    if (cibles.length === 0) return;
    const noms = cibles
      .slice(0, 10)
      .map((r) => nomComplet(r.figurants).trim())
      .join(", ");
    const suite = cibles.length > 10 ? ` et ${cibles.length - 10} autre${cibles.length - 10 > 1 ? "s" : ""}` : "";
    if (!confirm(`Mettre en réserve : ${noms}${suite} ?\n\n${cibles.length > 1 ? "Leurs bookings sont retirés de la journée" : "Son booking est retiré de la journée"} (aucun message n'est envoyé) et ${cibles.length > 1 ? "ils rejoignent" : "il rejoint"} la Réserve du projet.`)) return;
    startTransition(async () => {
      const res = await mettreBookingsEnReserve(cibles.map((r) => r.id));
      if (res.error) {
        alert(res.error);
        return;
      }
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
      setEspacePersoResult({ sent: result.sent ?? 0, failed: result.failed ?? 0, dejaCompte: result.dejaCompte ?? 0 });
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
      const result = await checkEmailReplies(projetId, date);
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
    const ids = replies.map((r) => r.messageId);
    setReplies([]);
    setLastCheckInfo(null);
    startTransition(async () => {
      await clearUnreviewedReplies(ids);
    });
  }

  const selectedRows = rows.filter((r) => selected.has(r.id));
  function ouvrirOutil(outil: "essayage" | "casting" | "changeDate" | "addDates") {
    setFigee({
      bookingIds: selectedRows.map((r) => r.id),
      figurantIds: selectedRows.map((r) => r.figurant_id).filter((id): id is string => !!id),
    });
    setEssayageOpen(outil === "essayage");
    setCastingOpen(outil === "casting");
    setChangeDateOpen(outil === "changeDate");
    setAddDatesOpen(outil === "addDates");
    if (outil === "essayage") setEssayageResult(null);
  }

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
    // Reprend le dernier message libre envoyé (sur tous les appareils).
    lireDernierMessage("journee-libre").then((dernier) => {
      if (!dernier) return;
      if (dernier.sujet) setLibreSubject(dernier.sujet);
      setLibreMessage(dernier.corps);
    });
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
      if (result.failed === 0 && !result.unmarked) {
        setSelected(new Set());
        setMessageMode("none");
      }
      router.refresh();
    });
  }

  function reinitialiserConvocation(ids: string[]) {
    if (ids.length === 0) return;
    setResetConvocationError(null);
    startTransition(async () => {
      const result = await resetConvocationEnvoyee(ids);
      if (result.error) { setResetConvocationError(result.error); return; }
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
        const result = await recordBookingMessage(r.figurant_id!, body, r.figurants!.email, subject, projetId, r.id);
        if (result?.error) failed += 1;
        else sent += 1;
      }
      setSendPending(false);
      setSendResult({ sent, failed });
      if (sent > 0) enregistrerDernierMessage("journee-libre", libreSubject, libreMessage);
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
                    {m.auteur && <> · par {m.auteur}</>}
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
    const tone = statutRowClasses(r.statut);
    return (
      <tr
        key={r.id}
        className={cn(
          "border-b-2 border-l-4 border-border last:border-b-0 hover:bg-ink-raised-2",
          tone.rowBorderL,
          tone.rowBg,
          r.reponse_recue && "bg-yellow-fluo/30 border-l-yellow-fluo"
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
            {r.portraitUrl && (() => {
              const gallery = toGalleryPhotos(r.photos);
              return (
                <ZoomableImage
                  src={r.portraitUrl}
                  imgClassName="rounded-full object-cover"
                  gallery={gallery}
                  index={galleryIndexOfUrl(gallery, r.portraitUrl)}
                />
              );
            })()}
          </div>
        </td>
        <td className="px-6 py-4 align-middle">
          <Link href={`/bookings/${r.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium hover:text-coral">
            <span className="min-w-0 max-w-full truncate">
              {r.figurants ? nomComplet(r.figurants) : "—"}
            </span>
            <BadgeMesBooking mes={r.mes} />
            {r.raccord && <RaccordBadge expanded={expandedRaccord.has(r.id)} onToggle={() => toggleRaccordExpanded(r.id)} />}
            {r.reponse_recue && (
              <Badge tone="yellow" title="A répondu à la convocation (BIEN REÇU)">
                ✓ Répondu convocation
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
          {r.candidatureId && (
            <div className="mt-1">
              <LienCandidature id={r.candidatureId} />
            </div>
          )}
          <div className="truncate text-xs text-text-muted">{ageEtVille(r)}</div>
          {rowDelai && (
            <div className={cn("text-[10px]", rowDelai.muted ? "text-yellow" : "text-turquoise")}>{rowDelai.text}</div>
          )}
          <div className="flex items-center gap-1">
            <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} variant="inline" />
            {previewIndexByBookingId.has(r.id) && (
              <PreviewButton items={previewItems} index={previewIndexByBookingId.get(r.id)!} />
            )}
            {projetId && r.figurant_id && (
              <PhotosTrombiPicker
                projetId={projetId}
                figurantId={r.figurant_id}
                nom={r.figurants ? nomComplet(r.figurants) : ""}
                compact
              />
            )}
          </div>
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
          <FonctionSelect
            value={r.fonction}
            besoins={fonctionsBesoins}
            autres={autresFonctions}
            disabled={pending}
            className={fieldClass}
            onChange={(fonction) => updateRow(r.id, { fonction })}
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
                r.reponse_recue ? "text-yellow" : "text-text"
              )}
            >
              <input
                type="checkbox"
                checked={r.reponse_recue}
                disabled={pending}
                onChange={(e) => updateRow(r.id, { reponse_recue: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-yellow"
              />
              Répondu convocation
            </label>
            <label
              title="A accepté la proposition de booking : passe en CONFIRMÉ"
              className={cn(
                "flex w-fit items-center gap-1.5 text-xs font-medium",
                r.reponse_booking ? "text-turquoise" : "text-text"
              )}
            >
              <input
                type="checkbox"
                checked={!!r.reponse_booking}
                disabled={pending}
                onChange={(e) => updateRow(r.id, { reponse_booking: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-turquoise"
              />
              Répondu booking
            </label>
            <NotesBooking r={r} disabled={pending} onSave={(notes) => updateRow(r.id, { notes })} />
            {r.figurants && (
              <button
                type="button"
                onClick={() => copyConvocationText(r)}
                className="w-fit rounded-full border border-border-strong px-2 py-0.5 text-[10px] font-medium text-text hover:border-coral/60 hover:text-text"
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
    const tone = statutRowClasses(r.statut);
    return (
      <div
        key={r.id}
        className={cn(
          "relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors hover:border-coral/60",
          r.reponse_recue ? "border-yellow-fluo bg-yellow-fluo/30 hover:border-yellow-fluo" : cn(tone.cardBorder, tone.cardBg)
        )}
      >
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggle(r.id)}
          className="absolute left-2 top-2 z-10 h-4 w-4 rounded border-border accent-coral"
        />
        {previewIndexByBookingId.has(r.id) && (
          <PreviewButton
            items={previewItems}
            index={previewIndexByBookingId.get(r.id)!}
            className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-xs hover:bg-ink"
          />
        )}
        <Link href={`/bookings/${r.id}`} className="flex w-full flex-col items-center gap-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
            {r.portraitUrl && (
              <Image
                src={r.portraitUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            )}
            {r.portraitUrl && (() => {
              const gallery = toGalleryPhotos(r.photos);
              return <ZoomButton src={r.portraitUrl!} gallery={gallery} index={galleryIndexOfUrl(gallery, r.portraitUrl)} />;
            })()}
            {r.raccord && (
              <span className="absolute right-1 top-1 z-10">
                <RaccordBadge expanded={expandedRaccord.has(r.id)} onToggle={() => toggleRaccordExpanded(r.id)} />
              </span>
            )}
          </div>
          <div className="text-sm font-medium">
            {r.figurants ? nomComplet(r.figurants) : "—"}
          </div>
          <BadgeMesBooking mes={r.mes} />
          {ageEtVille(r) && <div className="-mt-1 text-xs text-text-muted">{ageEtVille(r)}</div>}
          {projetId && r.figurant_id && (
            // La carte entière est un lien : le choix des photos ne doit pas
            // ouvrir le booking.
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <PhotosTrombiPicker
                projetId={projetId}
                figurantId={r.figurant_id}
                nom={r.figurants ? nomComplet(r.figurants) : ""}
                compact
              />
            </span>
          )}
          <label
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="A répondu à la convocation (BIEN REÇU)"
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              r.reponse_recue ? "bg-yellow font-semibold text-white" : "border border-border-strong bg-ink text-text"
            )}
          >
            <input
              type="checkbox"
              checked={r.reponse_recue}
              disabled={pending}
              onChange={(e) => updateRow(r.id, { reponse_recue: e.target.checked })}
              className="h-3 w-3 rounded border-border accent-yellow"
            />
            {r.reponse_recue ? "✓ Répondu convocation" : "Répondu convocation"}
          </label>
          <label
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            title="A accepté la proposition de booking : passe en CONFIRMÉ"
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              r.reponse_booking ? "bg-turquoise font-semibold text-white" : "border border-border-strong bg-ink text-text"
            )}
          >
            <input
              type="checkbox"
              checked={!!r.reponse_booking}
              disabled={pending}
              onChange={(e) => updateRow(r.id, { reponse_booking: e.target.checked })}
              className="h-3 w-3 rounded border-border accent-turquoise"
            />
            {r.reponse_booking ? "✓ Répondu booking" : "Répondu booking"}
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
        {r.candidatureId && <LienCandidature id={r.candidatureId} />}
        {expandedRaccord.has(r.id) && <RaccordDatesList dates={r.autresDates ?? []} />}
        <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} />
        <FonctionSelect
          value={r.fonction}
          besoins={fonctionsBesoins}
          autres={autresFonctions}
          disabled={pending}
          className={cn(fieldClass, "text-center")}
          onChange={(fonction) => updateRow(r.id, { fonction })}
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
        <NotesBooking r={r} disabled={pending} onSave={(notes) => updateRow(r.id, { notes })} />
        {r.figurants && (
          <button
            type="button"
            onClick={() => copyConvocationText(r)}
            className="w-full truncate rounded-full border border-border-strong px-1.5 py-0.5 text-[10px] font-medium text-text hover:border-coral/60 hover:text-text"
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
                  : "border-border-strong text-text hover:text-text"
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
              <button type="button" onClick={clearReplies} className="text-xs text-text hover:text-coral">
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
                  <span className="shrink-0 font-medium">{nomComplet(r)}</span>
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
          { value: "liste" as const, label: "📋 Liste" },
          { value: "trombi" as const, label: "🖼️ Trombinoscope" },
        ].map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setViewMode(v.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              viewMode === v.value
                ? "border-coral bg-coral/15 text-coral"
                : "border-border-strong text-text hover:text-text"
            )}
          >
            {v.label}
          </button>
        ))}
        {projetId && date && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-text-muted">
              {selected.size > 0 ? `Trombis / Fiches (${selected.size} sélectionné·e${selected.size > 1 ? "s" : ""})` : "Trombis / Fiches (tous)"}
            </span>
            <Link
              href={documentHref("trombis")}
              className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium text-text hover:border-coral/60 hover:text-text"
            >
              🖼️ Trombis
            </Link>
            <Link
              href={documentHref("fiches")}
              className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium text-text hover:border-coral/60 hover:text-text"
            >
              📏 Fiches mensuration
            </Link>
          </div>
        )}
        {filteredRows.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className={cn(
              "rounded-full border border-border-strong px-3 py-1 text-xs font-medium text-text hover:border-coral/60 hover:text-text",
              !(projetId && date) && "ml-auto"
            )}
          >
            {selected.size === filteredRows.length ? "⬜ Tout désélectionner" : "✅ Tout sélectionner"}
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
                  : "border-border-strong text-text hover:text-text"
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
            className="text-xs text-text hover:text-text hover:underline"
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
            !activeFonction ? "border-coral bg-coral/15 text-coral" : "border-border-strong text-text hover:text-text"
          )}
        >
          Toutes
        </button>
        {fonctionsJournee.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFonction((prev) => (prev === f ? null : f))}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              activeFonction === f
                ? "border-coral bg-coral/15 text-coral"
                : "border-border-strong text-text hover:text-text"
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
            !activeCachet ? "border-turquoise bg-turquoise/15 text-turquoise" : "border-border-strong text-text hover:text-text"
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
                  : "border-border-strong text-text hover:text-text"
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

      {changeDateMessage && (
        <Modale titre="🔀 Changement de date" onClose={() => setChangeDateMessage(null)}>
          <p className="text-sm font-medium text-turquoise">{changeDateMessage}</p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setChangeDateMessage(null)}>
              Fermer
            </Button>
          </div>
        </Modale>
      )}

      {changeDateOpen && projetId && (
        <Modale titre="🔀 Changer de date" onClose={() => setChangeDateOpen(false)} bloquee={pending}>
          <ChangeDateBar
            bookingIds={figee.bookingIds}
            currentDate={date}
            autresJournees={autresJournees}
            onDone={(message) => {
              setChangeDateOpen(false);
              setSelected(new Set());
              setChangeDateMessage(message);
            }}
            onPartial={(restantIds) => setSelected(new Set(restantIds))}
          />
        </Modale>
      )}

      {addDatesOpen && projetId && (
        <Modale titre="📅 Ajouter des dates" sousTitre={`${figee.figurantIds.length} personne${figee.figurantIds.length > 1 ? "s" : ""}`} onClose={() => setAddDatesOpen(false)} bloquee={pending}>
          <AddToJourneeBar
            figurantIds={figee.figurantIds}
            projets={[{ id: projetId, nom: rows[0]?.projets?.nom ?? "Ce projet" }]}
            onDone={() => setSelected(new Set())}
          />
        </Modale>
      )}

      {castingOpen && projetId && (
        <Modale titre="🎬 Envoyer au casting" sousTitre={`${figee.figurantIds.length} personne${figee.figurantIds.length > 1 ? "s" : ""}`} onClose={() => setCastingOpen(false)} bloquee={pending}>
          <AddToCastingBar
            figurantIds={figee.figurantIds}
            projets={[{ id: projetId, nom: rows[0]?.projets?.nom ?? "Ce projet" }]}
            onDone={() => setSelected(new Set())}
          />
        </Modale>
      )}

      {essayageOpen && projetId && (
        <Modale titre="👗 Envoyer à un essayage" sousTitre={`${figee.figurantIds.length} personne${figee.figurantIds.length > 1 ? "s" : ""}`} onClose={() => setEssayageOpen(false)} bloquee={pending}>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button type="button" variant="turquoise" disabled={pending || !essayageDate || selected.size === 0} onClick={sendToEssayage}>
              {pending ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
          {essayageResult && <p className="text-sm font-medium">{essayageResult}</p>}
        </Modale>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <span className="text-sm">{selected.size} sélectionné·e{selected.size > 1 ? "s" : ""}</span>
          <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-ink/40 px-3 py-2">
            <span className="text-xs text-text-muted">Modifier :</span>
            <select
              value={bulkStatut}
              onChange={(e) => setBulkStatut(e.target.value)}
              disabled={pending}
              className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
            >
              <option value="">Statut (inchangé)</option>
              {STATUTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <FonctionSelect
              value={bulkFonction || null}
              besoins={fonctionsBesoins}
              autres={autresFonctions}
              videLabel="Fonction (inchangée)"
              disabled={pending}
              className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
              onChange={(fonction) => setBulkFonction(fonction ?? "")}
            />
            <select
              value={bulkCachet}
              onChange={(e) => setBulkCachet(e.target.value)}
              disabled={pending}
              className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
            >
              <option value="">Cachet (inchangé)</option>
              {CACHETS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={bulkHeure}
              onChange={(e) => setBulkHeure(e.target.value)}
              disabled={pending}
              title="Heure de convocation (laisser vide pour ne pas changer)"
              className="rounded-full border border-border bg-ink px-4 py-1.5 text-sm outline-none disabled:opacity-60"
            />
            <Button
              type="button"
              disabled={pending || (!bulkStatut && !bulkFonction.trim() && !bulkCachet && !bulkHeure)}
              onClick={applyBulkChanges}
            >
              {pending ? "Mise à jour..." : "Appliquer"}
            </Button>
          </div>
          {bulkError && <p role="alert" className="w-full text-xs text-danger">{bulkError}</p>}
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
            📨 Convocation
          </Button>
          <Button type="button" variant="secondary" disabled={pending || sendPending} onClick={openLibreCompose}>
            💬 Message libre
          </Button>
          {projetId && (
            <Button type="button" variant="turquoise" disabled={pending} onClick={() => ouvrirOutil("essayage")}>
              👗 Envoyer à un essayage
            </Button>
          )}
          {projetId && (
            <Button type="button" variant="turquoise" disabled={pending} onClick={() => ouvrirOutil("casting")}>
              🎬 Envoyer au casting
            </Button>
          )}
          {projetId && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => ouvrirOutil("changeDate")}
            >
              🔀 Changer de date
            </Button>
          )}
          {projetId && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => ouvrirOutil("addDates")}
            >
              📅 Ajouter des dates
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
              🔗 Lien espace perso
            </Button>
          )}
          <Button type="button" variant="ghost" disabled={pending} onClick={hideSelection}>
            ✖️ Masquer la sélection
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={mettreEnReserve}>
            🗄️ Mettre en réserve
          </Button>
          <Button type="button" variant="danger" disabled={pending} onClick={retirerSelection}>
            🗑 Retirer de la journée
          </Button>
          {espacePersoOpen && projetId && (
            <Modale titre="🔗 Lien espace perso" onClose={() => setEspacePersoOpen(false)} bloquee={pending}>
            <div className="flex flex-wrap items-center gap-2">
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
                  {espacePersoResult.failed > 0 ? `, ${espacePersoResult.failed} échec(s)` : ""}
                  {espacePersoResult.dejaCompte
                    ? `, ${espacePersoResult.dejaCompte} ignoré${espacePersoResult.dejaCompte > 1 ? "s" : ""} (compte déjà créé)`
                    : ""}
                  .
                </span>
              )}
            </div>
            </Modale>
          )}

          {messageMode === "convocation-confirm" && (
            <Modale titre="📨 Envoyer la convocation" onClose={cancelMessageComposer} bloquee={sendPending}>
            <div className="flex flex-col gap-3">
              {resetConvocationError && <p role="alert" className="text-sm text-danger">{resetConvocationError}</p>}
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
                    <span>{nomComplet(r.figurants)}</span>
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
                      <span>{nomComplet(r.figurants)}</span>
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
              {!!sendResult?.unmarked && (
                <p role="alert" className="text-xs text-danger">{sendResult.unmarked} email(s) envoyé(s), mais leur statut n’a pas pu être enregistré. Vérifie les convocations avant tout nouvel envoi pour éviter les doublons.</p>
              )}
              {sendResult && (
                <p className="text-xs text-text-muted">
                  {sendResult.sent} envoyé{sendResult.sent > 1 ? "s" : ""}
                  {sendResult.failed > 0 ? `, ${sendResult.failed} échec(s)` : ""}.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" disabled={sendPending} onClick={cancelMessageComposer}>
                  Annuler
                </Button>
                <EnvoyerTextos
                  libelle={`📱 En textos (${selectedRows.length})`}
                  destinataires={selectedRows
                    .filter((r) => r.figurants)
                    .map((r) => ({
                      nom: nomComplet(r.figurants),
                      telephone: r.figurants!.telephone,
                      texte: convocationFor(r).body,
                      figurantId: r.figurant_id ?? null,
                      projetId: projetId ?? null,
                    }))}
                />
                <Button
                  type="button"
                  disabled={sendPending || convocationAEnvoyer.length === 0}
                  onClick={confirmSendConvocation}
                >
                  {sendPending ? "Envoi..." : `Confirmer et envoyer (${convocationAEnvoyer.length})`}
                </Button>
              </div>
            </div>
            </Modale>
          )}

          {(messageMode === "libre-compose" || messageMode === "libre-confirm") && (
            <Modale titre="💬 Message libre" onClose={cancelMessageComposer} bloquee={sendPending}>
            <div className="flex flex-col gap-3">
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
                        className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium text-text hover:text-text"
                      >
                        Vierge
                      </button>
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => applyLibreTemplate(t)}
                          className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium text-text hover:border-coral/60 hover:text-text"
                        >
                          {nomModele(t)}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input value={libreSubject} onChange={(e) => setLibreSubject(e.target.value)} placeholder="Sujet" />
                  <textarea
                    value={libreMessage}
                    onChange={(e) => setLibreMessage(e.target.value)}
                    placeholder="Votre message"
                    rows={8}
                    className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={cancelMessageComposer}>
                      Annuler
                    </Button>
                    <EnvoyerTextos
                      libelle={`📱 En textos (${selectedRows.length})`}
                      disabled={!libreMessage.trim()}
                      onEnvoye={() => enregistrerDernierMessage("journee-libre", libreSubject, libreMessage)}
                      destinataires={selectedRows
                        .filter((r) => r.figurants)
                        .map((r) => ({
                          nom: nomComplet(r.figurants),
                          telephone: r.figurants!.telephone,
                          texte: substituteTokens(libreMessage, rowTokens(r, journeeLieu)),
                          figurantId: r.figurant_id ?? null,
                          projetId: projetId ?? null,
                        }))}
                    />
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
                        {nomComplet(r.figurants)}
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
            </Modale>
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
                  .sort((a, b) => comparerNoms(a.figurants, b.figurants))
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
