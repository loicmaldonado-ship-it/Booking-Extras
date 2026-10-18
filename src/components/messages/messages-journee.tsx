"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { ContactIcons } from "@/components/ui/contact-icons";
import { rowTokens, type Row, type MessageRow } from "@/components/bookings/bookings-table";
import { substituteTokens } from "@/lib/bookings/convocation";
import { STATUTS, statutTone, type BookingStatut } from "@/lib/bookings/types";
import { bulkUpdateBookings, recordBookingMessage } from "@/lib/bookings/actions";
import { releverReponsesAuto, marquerReponseLueGmail } from "@/lib/bookings/inbox-actions";
import { mettreEnFileTextos } from "@/lib/textos/actions";
import { NOM_RACCOURCI } from "@/components/textos/envoyer-textos";
import { FIGURANT_MESSAGE_CATEGORIES } from "@/lib/candidats/types";
import { nomModele, type MessageTemplate } from "@/lib/templates/types";
import { formatPrenom, nomComplet, trierParNom } from "@/lib/noms";
import { telephoneInternational } from "@/lib/textos/telephone";
import { formatDateTime } from "@/lib/format-date";
import { cn } from "@/lib/cn";
import {
  creerEnvoi,
  envoyerEnvoiEmail,
  marquerEnvoiTextos,
  marquerRecu,
  supprimerEnvoi,
} from "@/lib/messages/envois-actions";
import type { EnvoiDestinataire, EnvoiJournee } from "@/lib/messages/envois";

const EXCLUS = new Set(["annulé", "indisponible", "a_rebooker"]);
const PAQUET = 10;

type Canal = "email" | "texto";
type Etat = "recu" | "repondu" | "attente" | "echec" | "non_envoye";
type EtatComplet = { etat: Etat; reponse: MessageRow | null };
type TextoPret = { cle: string; nom: string; telephone: string | null; texte: string };

const ETATS: Record<Etat, { label: string; classe: string }> = {
  recu: { label: "✓ Bien reçu", classe: "bg-turquoise/15 text-turquoise" },
  repondu: { label: "💬 A répondu", classe: "bg-coral/15 text-coral" },
  attente: { label: "⏳ Sans nouvelles", classe: "bg-yellow/15 text-yellow" },
  echec: { label: "⚠ Échec", classe: "bg-danger/15 text-danger" },
  non_envoye: { label: "Pas envoyé", classe: "bg-ink-raised-2 text-text" },
};

// Fond de carte selon le statut (même code couleur que Bookings) ; jaune
// fluo dès que la convocation a reçu son BIEN REÇU.
const CARTE_STATUT: Record<string, string> = {
  default: "border-border-strong bg-ink-raised",
  coral: "border-coral/60 bg-coral/10",
  turquoise: "border-turquoise/50 bg-turquoise/10",
  confirme: "border-turquoise bg-turquoise/25",
  yellow: "border-yellow/50 bg-yellow/10",
  danger: "border-danger/50 bg-danger/10",
  indispo: "border-danger bg-danger/25",
};
const SELECT_STATUT: Record<string, string> = {
  default: "bg-ink-raised-2 text-text",
  coral: "bg-coral/15 text-coral",
  turquoise: "bg-turquoise/15 text-turquoise",
  confirme: "bg-turquoise text-white",
  yellow: "bg-yellow/15 text-yellow",
  danger: "bg-danger/15 text-danger",
  indispo: "bg-danger text-white",
};
const BLEU_TEXTO = "bg-[#2563eb] text-white";

function lienRecu(origin: string, token: string) {
  return `${origin}/recu/${token}`;
}

function texteFinal(corps: string, r: Row, journeeLieu: string | null, avecAccuse: boolean, lien: string) {
  const texte = substituteTokens(corps, rowTokens(r, journeeLieu));
  return avecAccuse ? `${texte}\n\n👍 Merci de confirmer la bonne réception en un clic : ${lien}` : texte;
}

function categorieLabel(c: string) {
  return FIGURANT_MESSAGE_CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

// Textos personnalisés via le relais Mac (file d'attente).
async function textosDepuisMac(liste: TextoPret[]) {
  return mettreEnFileTextos(liste);
}

// Raccourci iPhone : la liste est copiée au moment du clic (Safari exige
// un geste direct pour le presse-papiers), puis le raccourci est lancé.
function textosDepuisIphone(liste: TextoPret[]) {
  const messages = liste
    .map((d) => ({ tel: telephoneInternational(d.telephone), texte: d.texte }))
    .filter((d): d is { tel: string; texte: string } => !!d.tel);
  return navigator.clipboard.writeText(JSON.stringify({ messages })).then(() => {
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(NOM_RACCOURCI)}`;
    return messages.length;
  });
}

// Réponse arrivée par mail : une fois traitée dans l'appli, on peut la
// passer en « lu » dans la boîte Gmail du projet.
function BoutonLuGmail({ m }: { m: MessageRow }) {
  const router = useRouter();
  const [pending, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  if (!m.mail_message_id || m.mail_message_id.startsWith("sms:") || m.sender !== "figurant") return null;
  if (m.lu_gmail_le) return <span className="text-[11px] font-medium text-turquoise">✓ Lu dans Gmail</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          setErreur(null);
          demarrer(async () => {
            const res = await marquerReponseLueGmail(m.id);
            if (res.error) setErreur(res.error);
            else router.refresh();
          });
        }}
        className="rounded-full border-2 border-coral bg-ink px-2 py-0.5 text-[11px] font-semibold text-coral disabled:opacity-50"
      >
        {pending ? "…" : "✓ Marquer comme lu dans Gmail"}
      </button>
      {erreur && <span className="text-[11px] text-danger">{erreur}</span>}
    </span>
  );
}

// Onglet Messages d'une journée : les profils à gauche (trombi ou liste,
// statut modifiable), un panneau fixe à droite avec deux sections séparées
// Mail et Texto (écrire + suivi), et la fiche messages de chaque profil.
// Confirmations et résultats dans le panneau, jamais en bandeau flottant.
export function MessagesJournee({
  rows,
  envois,
  projetId,
  date,
  templates,
  journeeLieu,
  publicOrigin,
  messagesByFigurant,
}: {
  rows: Row[];
  envois: EnvoiJournee[];
  projetId: string;
  date: string;
  templates: MessageTemplate[];
  journeeLieu: string | null;
  publicOrigin: string;
  messagesByFigurant: Record<string, MessageRow[]>;
}) {
  const router = useRouter();
  const actifs = useMemo(
    () => trierParNom(rows.filter((r) => r.figurants && !EXCLUS.has(r.statut)), (r) => r.figurants),
    [rows]
  );
  const rowParFigurant = useMemo(() => new Map(rows.map((r) => [r.figurant_id ?? "", r])), [rows]);
  const [cochés, setCochés] = useState<Set<string>>(new Set());
  const [filtre, setFiltre] = useState("tous");
  const [vue, setVue] = useState<"trombi" | "liste">(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("messages-vue") === "liste" ? "liste" : "trombi";
    } catch {
      return "trombi";
    }
  });
  const [canal, setCanal] = useState<Canal>("email");
  const [fiche, setFiche] = useState<string | null>(null);
  const [panneauMobile, setPanneauMobile] = useState(false);
  const [pending, demarrer] = useTransition();
  const [erreurLigne, setErreurLigne] = useState<string | null>(null);

  function changerVue(v: "trombi" | "liste") {
    setVue(v);
    try {
      localStorage.setItem("messages-vue", v);
    } catch {}
  }

  function maj(id: string, changes: Parameters<typeof bulkUpdateBookings>[1]) {
    setErreurLigne(null);
    demarrer(async () => {
      const res = await bulkUpdateBookings([id], changes);
      if (res.error) setErreurLigne(res.error);
      router.refresh();
    });
  }

  function etatDe(d: EnvoiDestinataire): EtatComplet {
    const reponse = d.envoye_le
      ? ((messagesByFigurant[d.figurant_id] ?? [])
          .filter((m) => m.sender === "figurant" && m.created_at > d.envoye_le!)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null)
      : null;
    if (reponse) return { etat: "repondu", reponse };
    if (d.accuse_le) return { etat: "recu", reponse: null };
    if (!d.envoye_le) return { etat: d.erreur ? "echec" : "non_envoye", reponse: null };
    return { etat: "attente", reponse: null };
  }

  const envoisParFigurant = useMemo(() => {
    const m = new Map<string, { envoi: EnvoiJournee; d: EnvoiDestinataire }[]>();
    for (const e of [...envois].reverse()) {
      for (const d of e.destinataires) {
        const l = m.get(d.figurant_id) ?? [];
        l.push({ envoi: e, d });
        m.set(d.figurant_id, l);
      }
    }
    return m;
  }, [envois]);

  function ouvrirFiche(bookingId: string) {
    setFiche(bookingId);
    setPanneauMobile(true);
  }

  const propositionRepondu = actifs.filter((r) => r.reponse_booking).length;
  const convocationEnvoyee = actifs.filter((r) => r.convocation_envoyee).length;
  const convocationRepondu = actifs.filter((r) => r.reponse_recue).length;
  const ficheRow = fiche ? (rows.find((r) => r.id === fiche) ?? null) : null;

  const panneauProps: PanneauProps = {
    actifs,
    cochés,
    onCochés: setCochés,
    canal,
    onCanal: setCanal,
    envois,
    etatDe,
    rowParFigurant,
    ficheRow,
    onFiche: setFiche,
    onFermer: () => {
      setPanneauMobile(false);
      setFiche(null);
    },
    maj,
    pending,
    erreurLigne,
    envoisParFigurant,
    messagesByFigurant,
    projetId,
    date,
    templates,
    journeeLieu,
    publicOrigin,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-border bg-ink px-3 py-1">
          Proposition : <strong>{propositionRepondu}</strong>/{actifs.length} ont répondu
        </span>
        <span className="rounded-full border border-border bg-ink px-3 py-1">
          Convocation : <strong>{convocationEnvoyee}</strong>/{actifs.length} envoyées · <strong>{convocationRepondu}</strong> BIEN REÇU
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <ProfilsJournee
          actifs={actifs}
          cochés={cochés}
          onCochés={setCochés}
          filtre={filtre}
          onFiltre={setFiltre}
          vue={vue}
          onVue={changerVue}
          envoisParFigurant={envoisParFigurant}
          etatDe={etatDe}
          onStatut={(id, statut) => maj(id, { statut })}
          onFiche={ouvrirFiche}
          pending={pending}
        />
        {/* Grand écran : panneau fixé à droite. */}
        <div className="hidden lg:sticky lg:top-4 lg:block">
          <Panneau {...panneauProps} />
        </div>
      </div>

      {/* iPad debout / téléphone : le panneau glisse depuis la droite. */}
      {panneauMobile && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-ink p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
          <Panneau {...panneauProps} />
        </div>
      )}
      {!panneauMobile && (
        <button
          type="button"
          onClick={() => setPanneauMobile(true)}
          className="fixed bottom-5 right-5 z-30 rounded-full bg-coral px-5 py-3 font-semibold text-ink shadow-lg lg:hidden"
        >
          ✉️ Envois{cochés.size > 0 ? ` · ${cochés.size}` : ""}
        </button>
      )}
    </div>
  );
}

function ProfilsJournee({
  actifs,
  cochés,
  onCochés,
  filtre,
  onFiltre,
  vue,
  onVue,
  envoisParFigurant,
  etatDe,
  onStatut,
  onFiche,
  pending,
}: {
  actifs: Row[];
  cochés: Set<string>;
  onCochés: (s: Set<string>) => void;
  filtre: string;
  onFiltre: (f: string) => void;
  vue: "trombi" | "liste";
  onVue: (v: "trombi" | "liste") => void;
  envoisParFigurant: Map<string, { envoi: EnvoiJournee; d: EnvoiDestinataire }[]>;
  etatDe: (d: EnvoiDestinataire) => EtatComplet;
  onStatut: (id: string, statut: BookingStatut) => void;
  onFiche: (bookingId: string) => void;
  pending: boolean;
}) {
  const envoisDe = (r: Row) => envoisParFigurant.get(r.figurant_id ?? "") ?? [];
  const aRepondu = (r: Row) => envoisDe(r).some((x) => etatDe(x.d).etat === "repondu");
  const affiches = actifs.filter((r) => {
    if (filtre === "sans_reponse_booking") return !r.reponse_booking;
    if (filtre === "sans_bien_recu") return r.convocation_envoyee && !r.reponse_recue;
    if (filtre === "attente") return envoisDe(r).some((x) => etatDe(x.d).etat === "attente");
    if (filtre === "reponses") return aRepondu(r);
    return true;
  });
  const tousCoches = affiches.length > 0 && affiches.every((r) => cochés.has(r.id));

  function basculer(id: string) {
    const next = new Set(cochés);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onCochés(next);
  }

  function selectStatut(r: Row) {
    const tone = statutTone(r.statut);
    return (
      <select
        value={r.statut}
        disabled={pending}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onStatut(r.id, e.target.value as BookingStatut)}
        aria-label={`Statut de ${nomComplet(r.figurants)}`}
        className={cn(
          "w-full cursor-pointer rounded-full border-0 px-3 py-1.5 text-center text-xs font-semibold outline-none disabled:opacity-60",
          SELECT_STATUT[tone] ?? SELECT_STATUT.default
        )}
      >
        {STATUTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    );
  }

  function pastilles(r: Row) {
    return (
      <div className="flex flex-wrap justify-center gap-1">
        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", r.reponse_booking ? ETATS.recu.classe : ETATS.attente.classe)}>
          Proposition {r.reponse_booking ? "✓" : "⏳"}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            !r.convocation_envoyee ? ETATS.non_envoye.classe : r.reponse_recue ? ETATS.recu.classe : ETATS.attente.classe
          )}
        >
          Convoc {!r.convocation_envoyee ? "–" : r.reponse_recue ? "✓" : "⏳"}
        </span>
        {envoisDe(r).map(({ envoi, d }) => {
          const { etat } = etatDe(d);
          return (
            <span
              key={envoi.id}
              title={`${envoi.titre} — ${ETATS[etat].label}`}
              className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", ETATS[etat].classe)}
            >
              {envoi.canal === "texto" ? "📱" : "✉️"} {envoi.titre.length > 12 ? `${envoi.titre.slice(0, 11)}…` : envoi.titre}{" "}
              {etat === "recu" ? "✓" : etat === "repondu" ? "💬" : etat === "attente" ? "⏳" : etat === "echec" ? "⚠" : "–"}
            </span>
          );
        })}
      </div>
    );
  }

  function boutonFiche(r: Row) {
    const rep = aRepondu(r);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFiche(r.id);
        }}
        className={cn(
          "w-full rounded-full border-2 bg-ink px-2 py-1 text-xs font-semibold",
          rep ? "border-coral text-coral" : "border-border-strong text-text hover:border-coral"
        )}
      >
        {rep ? "💬 Lire sa réponse" : "Ouvrir ses messages"}
      </button>
    );
  }

  const filtres = [
    { cle: "tous", label: `Tous (${actifs.length})` },
    { cle: "sans_reponse_booking", label: "Proposition sans réponse" },
    { cle: "sans_bien_recu", label: "Convocation sans BIEN REÇU" },
    { cle: "attente", label: "⏳ Sans nouvelles d'un message" },
    { cle: "reponses", label: "💬 Ont répondu" },
  ];

  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {filtres.map((f) => (
            <button
              key={f.cle}
              type="button"
              onClick={() => onFiltre(f.cle)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-medium",
                filtre === f.cle ? "border-coral bg-coral text-ink" : "border-border-strong bg-ink text-text hover:border-coral"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              const next = new Set(cochés);
              for (const r of affiches) {
                if (tousCoches) next.delete(r.id);
                else next.add(r.id);
              }
              onCochés(next);
            }}
            className="rounded-full border border-border-strong bg-ink px-2.5 py-1 font-medium text-text hover:border-coral"
          >
            {tousCoches ? "Tout décocher" : "Tout cocher"}
          </button>
          <div className="flex overflow-hidden rounded-full border border-border-strong">
            {(["trombi", "liste"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onVue(v)}
                className={cn("px-3 py-1 font-medium", vue === v ? "bg-coral text-ink" : "bg-ink text-text hover:text-coral")}
              >
                {v === "trombi" ? "🖼️ Trombi" : "☰ Liste"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {affiches.length === 0 ? (
        <p className="text-sm text-text-muted">Personne dans ce filtre.</p>
      ) : vue === "trombi" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {affiches.map((r) => {
            const coche = cochés.has(r.id);
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                aria-pressed={coche}
                onClick={() => basculer(r.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    basculer(r.id);
                  }
                }}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-center",
                  r.reponse_recue ? "border-yellow-fluo bg-yellow-fluo/30" : (CARTE_STATUT[statutTone(r.statut)] ?? CARTE_STATUT.default),
                  coche && "ring-4 ring-coral ring-offset-1"
                )}
              >
                <span
                  className={cn(
                    "absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 text-sm font-bold",
                    coche ? "border-coral bg-coral text-ink" : "border-border-strong bg-ink text-transparent"
                  )}
                  aria-hidden
                >
                  ✓
                </span>
                <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
                  {r.portraitUrl && (
                    <Image src={r.portraitUrl} alt="" fill sizes="(min-width: 1280px) 15vw, (min-width: 640px) 30vw, 45vw" className="object-cover" />
                  )}
                </div>
                <span className="text-sm font-medium leading-snug">{nomComplet(r.figurants)}</span>
                <span className="text-[11px] text-text-muted">{r.fonction ?? "Sans fonction"}</span>
                {selectStatut(r)}
                {pastilles(r)}
                {boutonFiche(r)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr>
                <th className="w-8 px-2 py-2"></th>
                <th className="px-2 py-2">Nom</th>
                <th className="px-2 py-2">Statut</th>
                <th className="px-2 py-2">Messages</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {affiches.map((r) => (
                <tr
                  key={r.id}
                  className={cn(r.reponse_recue && "bg-yellow-fluo/30", cochés.has(r.id) && "outline outline-2 -outline-offset-2 outline-coral")}
                >
                  <td className="px-2 py-2">
                    <input type="checkbox" checked={cochés.has(r.id)} onChange={() => basculer(r.id)} className="h-4 w-4 accent-coral" />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
                        {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill sizes="36px" className="object-cover" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{nomComplet(r.figurants)}</span>
                        <span className="text-[11px] text-text-muted">{r.fonction ?? "Sans fonction"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="w-40 px-2 py-2">{selectStatut(r)}</td>
                  <td className="px-2 py-2">
                    <div className="[&>div]:justify-start">{pastilles(r)}</div>
                  </td>
                  <td className="w-40 px-2 py-2">{boutonFiche(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

type PanneauProps = {
  actifs: Row[];
  cochés: Set<string>;
  onCochés: (s: Set<string>) => void;
  canal: Canal;
  onCanal: (c: Canal) => void;
  envois: EnvoiJournee[];
  etatDe: (d: EnvoiDestinataire) => EtatComplet;
  rowParFigurant: Map<string, Row>;
  ficheRow: Row | null;
  onFiche: (bookingId: string | null) => void;
  onFermer: () => void;
  maj: (id: string, changes: Parameters<typeof bulkUpdateBookings>[1]) => void;
  pending: boolean;
  erreurLigne: string | null;
  envoisParFigurant: Map<string, { envoi: EnvoiJournee; d: EnvoiDestinataire }[]>;
  messagesByFigurant: Record<string, MessageRow[]>;
  projetId: string;
  date: string;
  templates: MessageTemplate[];
  journeeLieu: string | null;
  publicOrigin: string;
};

function Panneau(props: PanneauProps) {
  const router = useRouter();
  const { actifs, cochés, onCochés, canal, onCanal, envois, ficheRow, onFiche, onFermer } = props;
  const [releve, setReleve] = useState<{ le: string | null; erreur?: string; enCours: boolean }>({ le: null, enCours: false });
  const choisis = actifs.filter((r) => cochés.has(r.id));
  const envoisCanal = envois.filter((e) => e.canal === canal);
  const projetId = props.projetId;

  // Relève automatique des réponses par mail (boîte d'envoi du projet) :
  // à l'ouverture de l'onglet puis toutes les 2 minutes tant qu'il est
  // ouvert ; une tâche planifiée la fait aussi toutes les 5 min en fond.
  useEffect(() => {
    let actif = true;
    async function relever() {
      setReleve((r) => ({ ...r, enCours: true }));
      const res = await releverReponsesAuto(projetId);
      if (!actif) return;
      setReleve({ le: res.releveLe, erreur: res.erreur, enCours: false });
      // Recharge aussi pour les réponses texto remontées par le relais Mac.
      router.refresh();
    }
    relever();
    const minuteur = setInterval(relever, 2 * 60 * 1000);
    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, [projetId, router]);

  const heureReleve = releve.le ? new Date(releve.le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-border-strong bg-ink p-4 shadow-sm lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{ficheRow ? "Messages du profil" : "Envois de la journée"}</h2>
        <button type="button" onClick={onFermer} className="rounded-full border-2 border-border-strong px-3 py-1 text-xs font-semibold lg:hidden">
          Fermer
        </button>
      </div>

      {ficheRow ? (
        <FicheProfil {...props} r={ficheRow} onRetour={() => onFiche(null)} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {choisis.length > 0 ? (
              <>
                <span>
                  <strong>{choisis.length}</strong> personne{choisis.length > 1 ? "s" : ""} sélectionnée{choisis.length > 1 ? "s" : ""}
                </span>
                <button type="button" onClick={() => onCochés(new Set())} className="text-xs font-semibold text-coral underline underline-offset-2">
                  Tout désélectionner
                </button>
              </>
            ) : (
              <span className="text-text-muted">Coche des profils pour leur écrire.</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-raised p-1" role="tablist">
            {(["email", "texto"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={canal === c}
                onClick={() => onCanal(c)}
                className={cn(
                  "rounded-lg py-2 text-sm font-semibold",
                  canal === c ? (c === "email" ? "bg-coral text-ink" : BLEU_TEXTO) : "text-text hover:bg-ink"
                )}
              >
                {c === "email" ? "✉️ Mail" : "📱 Texto"}{" "}
                <span className="text-xs font-medium opacity-80">· {envois.filter((e) => e.canal === c).length}</span>
              </button>
            ))}
          </div>

          <Ecrire key={canal} {...props} choisis={choisis} />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              Suivi des {canal === "email" ? "mails" : "textos"}
            </span>
            {canal === "email" && (
              <span className="text-[11px] text-text-muted" title="Les réponses par mail sont relevées automatiquement dans la boîte d'envoi du projet.">
                {releve.enCours ? "📥 Relève des réponses…" : heureReleve ? `📥 Réponses relevées à ${heureReleve} (auto)` : "📥 Relève automatique"}
              </span>
            )}
          </div>
          {canal === "email" && releve.erreur && <p className="text-xs text-danger">Boîte mail du projet : {releve.erreur}</p>}
          {canal === "texto" && (
            <p className="text-[11px] text-text-muted">
              Les réponses texto remontent toutes seules si le relais Mac est installé et autorisé (Mon compte → Textos) ;
              sinon, coche « Marquer reçu » à la main.
            </p>
          )}
          {envoisCanal.length === 0 ? (
            <p className="text-sm text-text-muted">Aucun {canal === "email" ? "mail" : "texto"} d&apos;info envoyé pour cette journée.</p>
          ) : (
            envoisCanal.map((e) => <SuiviEnvoi key={e.id} {...props} envoi={e} />)
          )}
        </>
      )}
    </div>
  );
}

function Ecrire({ canal, choisis, templates, projetId, date, journeeLieu, publicOrigin }: PanneauProps & { choisis: Row[] }) {
  const router = useRouter();
  const [titre, setTitre] = useState("");
  const [sujet, setSujet] = useState(`Infos – ${date}`);
  const [corps, setCorps] = useState("Bonjour {prenom},\n\n");
  const [avecAccuse, setAvecAccuse] = useState(true);
  const [etape, setEtape] = useState<"ecrire" | "confirmer" | "iphone" | "fait">("ecrire");
  const [bilan, setBilan] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [progression, setProgression] = useState<string | null>(null);
  const [prets, setPrets] = useState<{ envoiId: string; liste: TextoPret[] } | null>(null);
  const [pending, demarrer] = useTransition();
  const n = choisis.length;
  const texto = canal === "texto";
  const pret = n > 0 && titre.trim() !== "" && corps.trim() !== "";
  const sansContact = texto
    ? choisis.filter((r) => !telephoneInternational(r.figurants?.telephone ?? null)).length
    : choisis.filter((r) => !r.figurants?.email).length;
  const couleur = texto ? BLEU_TEXTO : "bg-coral text-ink";
  const verrouille = etape !== "ecrire";

  async function preparer() {
    const res = await creerEnvoi({
      projetId,
      date,
      titre,
      sujet,
      corps,
      canal,
      avecAccuse,
      destinataires: choisis.map((r) => ({ figurantId: r.figurant_id!, bookingId: r.id })),
    });
    if (res.error || !res.envoiId || !res.tokens) {
      setErreur(res.error ?? "Envoi impossible.");
      return null;
    }
    return { envoiId: res.envoiId, tokens: res.tokens };
  }

  function confirmerMail() {
    setErreur(null);
    demarrer(async () => {
      const prep = await preparer();
      if (!prep) return;
      let envoyes = 0;
      let echecs = 0;
      const items = choisis.map((r) => {
        const t = prep.tokens[r.figurant_id!];
        return {
          destinataireId: t.id,
          figurantId: r.figurant_id!,
          bookingId: r.id,
          email: r.figurants?.email ?? null,
          sujet: substituteTokens(sujet, rowTokens(r, journeeLieu)),
          corps: texteFinal(corps, r, journeeLieu, avecAccuse, lienRecu(publicOrigin, t.token)),
        };
      });
      for (let i = 0; i < items.length; i += PAQUET) {
        setProgression(`Envoi… ${envoyes + echecs}/${items.length}`);
        const res = await envoyerEnvoiEmail(prep.envoiId, items.slice(i, i + PAQUET));
        if (res.error) {
          setErreur(res.error);
          break;
        }
        envoyes += res.envoyes;
        echecs += res.echecs;
      }
      setProgression(null);
      setBilan(
        `✓ Parti à ${envoyes} personne${envoyes > 1 ? "s" : ""}${echecs ? ` · ⚠ ${echecs} non envoyé${echecs > 1 ? "s" : ""} (sans email)` : ""}. Le suivi est juste en dessous.`
      );
      setEtape("fait");
      router.refresh();
    });
  }

  function confirmerTexto(mode: "mac" | "iphone") {
    setErreur(null);
    demarrer(async () => {
      const prep = await preparer();
      if (!prep) return;
      const liste: TextoPret[] = choisis.map((r) => {
        const t = prep.tokens[r.figurant_id!];
        return {
          cle: t.id,
          nom: nomComplet(r.figurants),
          telephone: r.figurants?.telephone ?? null,
          texte: texteFinal(corps, r, journeeLieu, avecAccuse, lienRecu(publicOrigin, t.token)),
        };
      });
      if (mode === "mac") {
        const res = await textosDepuisMac(liste);
        if (res.error) {
          await supprimerEnvoi(prep.envoiId);
          setErreur(res.error);
          return;
        }
        await marquerEnvoiTextos(
          prep.envoiId,
          liste.filter((d) => telephoneInternational(d.telephone)).map((d) => d.cle)
        );
        setBilan(`✓ ${res.enFile} texto${res.enFile > 1 ? "s" : ""} en file sur ton Mac (environ 10 s d'écart). Le suivi est juste en dessous.`);
        setEtape("fait");
        router.refresh();
      } else {
        setPrets({ envoiId: prep.envoiId, liste });
        setEtape("iphone");
      }
    });
  }

  function lancerIphone() {
    if (!prets) return;
    textosDepuisIphone(prets.liste)
      .then(async (nb) => {
        await marquerEnvoiTextos(
          prets.envoiId,
          prets.liste.filter((d) => telephoneInternational(d.telephone)).map((d) => d.cle)
        );
        setBilan(`✓ ${nb} texto${nb > 1 ? "s" : ""} passé${nb > 1 ? "s" : ""} au raccourci iPhone. Le suivi est juste en dessous.`);
        setEtape("fait");
        router.refresh();
      })
      .catch(() => setErreur("Impossible de copier la liste sur cet appareil."));
  }

  function annulerIphone() {
    if (prets) supprimerEnvoi(prets.envoiId).then(() => router.refresh());
    setPrets(null);
    setEtape("ecrire");
  }

  return (
    <section className={cn("flex flex-col gap-2 rounded-xl border-t-4 bg-ink-raised p-3", texto ? "border-t-[#2563eb]" : "border-t-coral")}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{texto ? "Écrire un texto" : "Écrire un mail"}</span>
      {templates.length > 0 && !verrouille && (
        <select
          value=""
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (!t) return;
            setSujet(t.sujet);
            setCorps(t.corps);
            if (!titre.trim()) setTitre(t.nom.replace(/^.*·\s*/, ""));
          }}
          aria-label="Partir d'un modèle"
          className="w-full rounded-lg border-2 border-border-strong bg-ink px-3 py-1.5 text-xs font-semibold text-text"
        >
          <option value="">📄 Partir d&apos;un modèle…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {nomModele(t)}
            </option>
          ))}
        </select>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium">
        Nom du message (pour le suivi)
        <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Parking, Horaire avancé, Tenue…" maxLength={80} disabled={verrouille} />
      </label>
      {!texto && (
        <label className="flex flex-col gap-1 text-xs font-medium">
          Objet
          <Input value={sujet} onChange={(e) => setSujet(e.target.value)} disabled={verrouille} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium">
        {texto ? "Texto" : "Message"}
        <Textarea rows={texto ? 4 : 6} value={corps} onChange={(e) => setCorps(e.target.value)} disabled={verrouille} />
        <span className="font-normal text-text-muted">
          {"{prenom} {date} {lieu} {fonction} {cachet} {signature}"} remplacés pour chacun
          {texto ? ` · ${corps.length} caractères` : ""}
        </span>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={avecAccuse} onChange={(e) => setAvecAccuse(e.target.checked)} disabled={verrouille} />
        Demander un « 👍 Bien reçu » (lien en un clic)
      </label>

      {erreur && <p className="text-xs text-danger">{erreur}</p>}

      {etape === "ecrire" && (
        <button
          type="button"
          disabled={!pret}
          onClick={() => setEtape("confirmer")}
          className={cn("rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40", couleur)}
        >
          {texto ? "📱" : "✉️"} Envoyer à {n} personne{n > 1 ? "s" : ""}
        </button>
      )}
      {etape === "confirmer" && (
        <div className={cn("flex flex-col gap-2 rounded-xl border-2 bg-ink p-3 text-sm", texto ? "border-[#2563eb]" : "border-coral")}>
          <p>
            Envoyer <strong>« {titre} »</strong> {texto ? "en texto" : "par mail"} à <strong>{n}</strong> personne{n > 1 ? "s" : ""} ?
            {sansContact > 0 && (
              <span className="block text-xs text-danger">
                {sansContact} sans {texto ? "numéro de portable" : "email"} : pas envoyé{sansContact > 1 ? "s" : ""}.
              </span>
            )}
          </p>
          {progression && <p className="text-xs text-text-muted">{progression}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setEtape("ecrire")} className="flex-1">
              Modifier
            </Button>
            {texto ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirmerTexto("iphone")}
                  className={cn("flex-1 rounded-full py-2 text-sm font-semibold disabled:opacity-50", couleur)}
                >
                  📱 Depuis l&apos;iPhone
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirmerTexto("mac")}
                  className={cn("flex-1 rounded-full py-2 text-sm font-semibold disabled:opacity-50", couleur)}
                >
                  💻 Depuis le Mac
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={confirmerMail}
                className={cn("flex-1 rounded-full py-2 text-sm font-semibold disabled:opacity-50", couleur)}
              >
                {pending ? "Envoi…" : "Confirmer l'envoi"}
              </button>
            )}
          </div>
        </div>
      )}
      {etape === "iphone" && (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-[#2563eb] bg-ink p-3 text-sm">
          <p>Textes prêts. Appuie pour copier la liste et lancer le raccourci « {NOM_RACCOURCI} » (site ouvert sur l&apos;iPhone).</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={annulerIphone} className="flex-1">
              Annuler
            </Button>
            <button type="button" onClick={lancerIphone} className={cn("flex-1 rounded-full py-2 text-sm font-semibold", couleur)}>
              📱 Lancer le raccourci
            </button>
          </div>
        </div>
      )}
      {etape === "fait" && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-turquoise">{bilan}</p>
          <button
            type="button"
            onClick={() => {
              setEtape("ecrire");
              setTitre("");
              setBilan(null);
            }}
            className="self-start text-xs font-semibold text-coral underline underline-offset-2"
          >
            Écrire un autre message
          </button>
        </div>
      )}
    </section>
  );
}

function SuiviEnvoi({ envoi, etatDe, rowParFigurant, onFiche, journeeLieu, publicOrigin }: PanneauProps & { envoi: EnvoiJournee }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [pending, demarrer] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const ordre: Record<Etat, number> = { repondu: 0, attente: 1, echec: 2, non_envoye: 3, recu: 4 };
  const lignes = trierParNom(
    envoi.destinataires.map((d) => ({ d, r: rowParFigurant.get(d.figurant_id), ...etatDe(d) })),
    (l) => l.r?.figurants
  ).sort((a, b) => ordre[a.etat] - ordre[b.etat]);
  const compte = (e: Etat) => lignes.filter((l) => l.etat === e).length;
  const total = lignes.length || 1;
  const aRelancer = lignes.filter((l) => l.etat === "attente" && l.r);

  function relancerMail() {
    demarrer(async () => {
      const res = await envoyerEnvoiEmail(
        envoi.id,
        aRelancer.map(({ d, r }) => ({
          destinataireId: d.id,
          figurantId: d.figurant_id,
          bookingId: d.booking_id,
          email: r!.figurants?.email ?? null,
          sujet: `Rappel : ${substituteTokens(envoi.sujet, rowTokens(r!, journeeLieu))}`,
          corps: texteFinal(envoi.corps, r!, journeeLieu, envoi.avec_accuse, lienRecu(publicOrigin, d.token)),
        })),
        true
      );
      setInfo(res.error ? `⚠ ${res.error}` : `🔁 ${res.envoyes} relance${res.envoyes > 1 ? "s" : ""} envoyée${res.envoyes > 1 ? "s" : ""}.`);
      router.refresh();
    });
  }

  function relancerTextosMac() {
    demarrer(async () => {
      const liste: TextoPret[] = aRelancer.map(({ d, r }) => ({
        cle: d.id,
        nom: nomComplet(r!.figurants),
        telephone: r!.figurants?.telephone ?? null,
        texte: `Rappel : ${texteFinal(envoi.corps, r!, journeeLieu, envoi.avec_accuse, lienRecu(publicOrigin, d.token))}`,
      }));
      const res = await textosDepuisMac(liste);
      if (res.error) {
        setInfo(`⚠ ${res.error}`);
        return;
      }
      await marquerEnvoiTextos(envoi.id, liste.map((x) => x.cle), true);
      setInfo(`🔁 ${res.enFile} relance${res.enFile > 1 ? "s" : ""} en file sur ton Mac.`);
      router.refresh();
    });
  }

  function basculerRecu(id: string, recu: boolean) {
    demarrer(async () => {
      await marquerRecu(id, recu);
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-border-strong bg-ink">
      <button type="button" onClick={() => setOuvert((v) => !v)} className="flex w-full flex-col gap-1.5 px-3 py-2.5 text-left">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">
            {envoi.titre} <span className="text-text-muted">{ouvert ? "▾" : "▸"}</span>
          </span>
          <span className="whitespace-nowrap text-[11px] text-text-muted">{formatDateTime(envoi.created_at)}</span>
        </span>
        <span className="flex h-2 overflow-hidden rounded-full bg-ink-raised-2">
          <span className="bg-turquoise" style={{ width: `${(compte("recu") / total) * 100}%` }} />
          <span className="bg-coral" style={{ width: `${(compte("repondu") / total) * 100}%` }} />
          <span className="bg-yellow" style={{ width: `${(compte("attente") / total) * 100}%` }} />
          <span className="bg-danger" style={{ width: `${(compte("echec") / total) * 100}%` }} />
        </span>
        <span className="flex flex-wrap gap-x-3 text-[11px] font-medium">
          <span className="text-turquoise">✓ {compte("recu")} bien reçu</span>
          <span className="text-coral">
            💬 {compte("repondu")} réponse{compte("repondu") > 1 ? "s" : ""}
          </span>
          <span className="text-yellow">⏳ {compte("attente")} sans nouvelles</span>
          {compte("echec") > 0 && <span className="text-danger">⚠ {compte("echec")} échec</span>}
        </span>
      </button>

      {ouvert && (
        <div className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-2">
          {lignes.map(({ d, r, etat, reponse }) => (
            <div key={d.id} className="flex flex-col gap-1 border-b border-dashed border-border py-1.5 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => r && onFiche(r.id)}
                  className="text-left text-sm font-medium underline decoration-border-strong underline-offset-2"
                >
                  {r ? nomComplet(r.figurants) : "Profil retiré de la journée"}
                </button>
                <span className="flex items-center gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ETATS[etat].classe)}>{ETATS[etat].label}</span>
                  {(etat === "attente" || etat === "recu") && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => basculerRecu(d.id, !d.accuse_le)}
                      className={cn(
                        "rounded-full border-2 border-turquoise px-2 py-0.5 text-[11px] font-semibold disabled:opacity-50",
                        d.accuse_le ? "bg-turquoise text-white" : "bg-ink text-turquoise"
                      )}
                    >
                      {d.accuse_le ? "✓ Reçu" : "Marquer reçu"}
                    </button>
                  )}
                </span>
              </div>
              {reponse && (
                <div className="flex flex-col gap-1 rounded-lg border-l-4 border-coral bg-ink-raised px-2 py-1">
                  <p className="text-xs italic">
                    « {reponse.corps.length > 220 ? `${reponse.corps.slice(0, 220)}…` : reponse.corps} »{" "}
                    <span className="not-italic text-text-muted">— {formatDateTime(reponse.created_at)}</span>
                  </p>
                  <BoutonLuGmail m={reponse} />
                </div>
              )}
              {etat === "echec" && d.erreur && <span className="text-[11px] text-danger">{d.erreur}</span>}
            </div>
          ))}

          {aRelancer.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={envoi.canal === "email" ? relancerMail : relancerTextosMac}
              className="rounded-xl border-2 border-yellow bg-ink py-2 text-sm font-semibold text-yellow disabled:opacity-50"
            >
              🔁 Relancer les {aRelancer.length} sans nouvelles{envoi.canal === "texto" ? " (Mac)" : ""}
            </button>
          )}
          {info && <p className="text-xs font-medium text-text">{info}</p>}
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-text">Voir le message envoyé</summary>
            <p className="mt-2 whitespace-pre-line rounded-lg bg-ink-raised p-2 text-xs">{envoi.corps}</p>
          </details>
          {confirmerSuppression ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span>Supprimer ce suivi ? Les messages restent dans l&apos;historique des profils.</span>
              <button type="button" onClick={() => setConfirmerSuppression(false)} className="font-semibold underline">
                Non
              </button>
              <button
                type="button"
                onClick={() =>
                  demarrer(async () => {
                    await supprimerEnvoi(envoi.id);
                    router.refresh();
                  })
                }
                className="font-semibold text-danger underline"
              >
                Oui, supprimer
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmerSuppression(true)} className="self-start text-xs font-semibold text-danger">
              Supprimer ce suivi
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FicheProfil({
  r,
  onRetour,
  maj,
  pending,
  erreurLigne,
  envoisParFigurant,
  etatDe,
  messagesByFigurant,
  projetId,
}: PanneauProps & { r: Row; onRetour: () => void }) {
  const router = useRouter();
  const [reponse, setReponse] = useState("");
  const [etatEnvoi, setEtatEnvoi] = useState<string | null>(null);
  const [envoiPending, demarrer] = useTransition();
  const [recuPending, demarrerRecu] = useTransition();
  const fil = [...(messagesByFigurant[r.figurant_id ?? ""] ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const envoisProfil = envoisParFigurant.get(r.figurant_id ?? "") ?? [];
  const tone = statutTone(r.statut);
  const prenom = formatPrenom(r.figurants?.prenom);
  const tel = telephoneInternational(r.figurants?.telephone ?? null);

  function repondreMail() {
    if (!reponse.trim() || !r.figurants?.email) return;
    demarrer(async () => {
      const res = await recordBookingMessage(
        r.figurant_id!,
        reponse.trim(),
        r.figurants!.email,
        `Re : ${r.projets?.nom ?? "tournage"}`,
        projetId,
        r.id
      );
      setEtatEnvoi(res?.error ? `⚠ ${res.error}` : "✓ Mail envoyé, il apparaît dans la conversation.");
      if (!res?.error) setReponse("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={onRetour} className="self-start rounded-full border-2 border-border-strong bg-ink px-3 py-1 text-sm font-semibold">
        ← Tous les envois
      </button>
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
          {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill sizes="56px" className="object-cover" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-semibold">{nomComplet(r.figurants)}</span>
          <span className="text-xs text-text-muted">{r.fonction ?? "Sans fonction"}</span>
          <select
            value={r.statut}
            disabled={pending}
            onChange={(e) => maj(r.id, { statut: e.target.value as BookingStatut })}
            aria-label="Statut"
            className={cn("w-full rounded-full border-0 px-3 py-1.5 text-center text-xs font-semibold", SELECT_STATUT[tone] ?? SELECT_STATUT.default)}
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} variant="inline" />
      {erreurLigne && <p className="text-xs text-danger">{erreurLigne}</p>}

      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Réponses aux messages</span>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-ink-raised px-3 py-2 text-sm">
          <span>Proposition de booking</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => maj(r.id, { reponse_booking: !r.reponse_booking })}
            title="Coché : la personne passe en CONFIRMÉ"
            className={cn(
              "rounded-full border-2 border-turquoise px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50",
              r.reponse_booking ? "bg-turquoise text-white" : "bg-ink text-turquoise"
            )}
          >
            {r.reponse_booking ? "✓ Répondu booking" : "Répondu booking → CONFIRMÉ"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-ink-raised px-3 py-2 text-sm">
          <span>
            Convocation{!r.convocation_envoyee && <span className="text-text-muted"> (pas encore envoyée)</span>}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => maj(r.id, { reponse_recue: !r.reponse_recue })}
            title="Coché : la carte passe en jaune (BIEN REÇU)"
            className={cn(
              "rounded-full border-2 border-yellow px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50",
              r.reponse_recue ? "bg-yellow text-white" : "bg-ink text-yellow"
            )}
          >
            {r.reponse_recue ? "✓ Répondu convocation" : "Répondu convocation"}
          </button>
        </div>
        {envoisProfil.map(({ envoi, d }) => {
          const { etat } = etatDe(d);
          return (
            <div key={envoi.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-raised px-3 py-2 text-sm">
              <span>
                {envoi.canal === "texto" ? "📱" : "✉️"} {envoi.titre}
              </span>
              {etat === "attente" || etat === "recu" ? (
                <button
                  type="button"
                  disabled={recuPending}
                  onClick={() =>
                    demarrerRecu(async () => {
                      await marquerRecu(d.id, !d.accuse_le);
                      router.refresh();
                    })
                  }
                  className={cn(
                    "rounded-full border-2 border-turquoise px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50",
                    d.accuse_le ? "bg-turquoise text-white" : "bg-ink text-turquoise"
                  )}
                >
                  {d.accuse_le ? "✓ Reçu" : "Marquer reçu"}
                </button>
              ) : (
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ETATS[etat].classe)}>{ETATS[etat].label}</span>
              )}
            </div>
          );
        })}
      </div>

      <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Conversation</span>
      {fil.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun message échangé pour l&apos;instant.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {fil.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex max-w-[90%] flex-col gap-0.5 rounded-2xl px-3 py-2 text-sm",
                m.sender === "staff" ? "self-end rounded-br-sm bg-coral text-ink" : "self-start rounded-bl-sm border-2 border-border-strong bg-ink"
              )}
            >
              <span className="text-[10px] opacity-80">
                {m.sender === "staff" ? categorieLabel(m.categorie) : prenom} · {formatDateTime(m.created_at)}
              </span>
              {m.sujet && <span className="text-xs font-semibold">{m.sujet}</span>}
              <span className="whitespace-pre-line">{m.corps.length > 600 ? `${m.corps.slice(0, 600)}…` : m.corps}</span>
              <BoutonLuGmail m={m} />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-ink-raised p-3">
        <Textarea rows={2} value={reponse} onChange={(e) => setReponse(e.target.value)} placeholder={`Répondre à ${prenom}…`} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={envoiPending || !reponse.trim() || !r.figurants?.email}
            onClick={repondreMail}
            className="rounded-full bg-coral py-2 text-sm font-semibold text-ink disabled:opacity-40"
          >
            ✉️ Par mail
          </button>
          <a
            href={tel && reponse.trim() ? `sms:${tel}&body=${encodeURIComponent(reponse.trim())}` : undefined}
            aria-disabled={!tel || !reponse.trim()}
            className={cn("rounded-full py-2 text-center text-sm font-semibold", BLEU_TEXTO, (!tel || !reponse.trim()) && "pointer-events-none opacity-40")}
          >
            📱 Par texto
          </a>
        </div>
        {etatEnvoi && <p className="text-xs font-medium">{etatEnvoi}</p>}
      </div>
    </div>
  );
}
