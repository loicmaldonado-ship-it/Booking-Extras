"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Modale } from "@/components/ui/modale";
import { EnvoyerTextos } from "@/components/textos/envoyer-textos";
import { rowTokens, type Row, type MessageRow } from "@/components/bookings/bookings-table";
import { substituteTokens } from "@/lib/bookings/convocation";
import { statutLabel } from "@/lib/bookings/types";
import { nomModele, type MessageTemplate } from "@/lib/templates/types";
import { nomComplet, trierParNom } from "@/lib/noms";
import { telephoneInternational, type DestinataireTexto } from "@/lib/textos/telephone";
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

type Etat = "recu" | "repondu" | "attente" | "echec" | "non_envoye";

const ETATS: Record<Etat, { label: string; tone: "turquoise" | "coral" | "yellow" | "danger" | "default" }> = {
  recu: { label: "✓ Bien reçu", tone: "turquoise" },
  repondu: { label: "💬 A répondu", tone: "coral" },
  attente: { label: "⏳ Sans nouvelles", tone: "yellow" },
  echec: { label: "⚠ Échec", tone: "danger" },
  non_envoye: { label: "Pas envoyé", tone: "default" },
};

function lienRecu(origin: string, token: string) {
  return `${origin}/recu/${token}`;
}

function texteFinal(corps: string, r: Row, journeeLieu: string | null, avecAccuse: boolean, lien: string) {
  const texte = substituteTokens(corps, rowTokens(r, journeeLieu));
  return avecAccuse ? `${texte}\n\n👍 Merci de confirmer la bonne réception en un clic : ${lien}` : texte;
}

// Onglet Messages d'une journée : envoyer un message d'info nommé à une
// sélection (email ou textos), avec accusé de réception en un clic, et
// suivre qui l'a reçu, qui a répondu, qui relancer.
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
  const actifs = useMemo(() => trierParNom(rows.filter((r) => r.figurants && !EXCLUS.has(r.statut)), (r) => r.figurants), [rows]);
  const rowParFigurant = useMemo(() => new Map(rows.map((r) => [r.figurant_id, r])), [rows]);
  const [composer, setComposer] = useState(false);

  const propositionRepondu = actifs.filter((r) => r.reponse_booking).length;
  const convocationEnvoyee = actifs.filter((r) => r.convocation_envoyee).length;
  const convocationRepondu = actifs.filter((r) => r.reponse_recue).length;

  function etatDe(d: EnvoiDestinataire): Etat {
    if (d.accuse_le) return "recu";
    if (!d.envoye_le) return d.erreur ? "echec" : "non_envoye";
    const reponse = (messagesByFigurant[d.figurant_id] ?? []).some(
      (m) => m.sender === "figurant" && m.created_at > d.envoye_le!
    );
    return reponse ? "repondu" : "attente";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-ink px-3 py-1">
            Proposition : <strong>{propositionRepondu}</strong>/{actifs.length} ont répondu
          </span>
          <span className="rounded-full bg-ink px-3 py-1">
            Convocation : <strong>{convocationEnvoyee}</strong>/{actifs.length} envoyées ·{" "}
            <strong>{convocationRepondu}</strong> BIEN REÇU
          </span>
        </div>
        <Button type="button" onClick={() => setComposer(true)} disabled={actifs.length === 0}>
          ✉️ Nouveau message
        </Button>
      </Card>

      {composer && (
        <Composer
          actifs={actifs}
          projetId={projetId}
          date={date}
          templates={templates}
          journeeLieu={journeeLieu}
          publicOrigin={publicOrigin}
          onClose={() => setComposer(false)}
        />
      )}

      {envois.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            Aucun message d&apos;info envoyé pour cette journée. « Nouveau message » pour prévenir une sélection
            (parking, changement d&apos;horaire, tenue…) et suivre qui l&apos;a bien reçu.
          </p>
        </Card>
      ) : (
        envois.map((e) => (
          <EnvoiCarte
            key={e.id}
            envoi={e}
            etatDe={etatDe}
            rowParFigurant={rowParFigurant}
            journeeLieu={journeeLieu}
            publicOrigin={publicOrigin}
          />
        ))
      )}
    </div>
  );
}

function Composer({
  actifs,
  projetId,
  date,
  templates,
  journeeLieu,
  publicOrigin,
  onClose,
}: {
  actifs: Row[];
  projetId: string;
  date: string;
  templates: MessageTemplate[];
  journeeLieu: string | null;
  publicOrigin: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<Set<string>>(() => new Set(actifs.map((r) => r.id)));
  const [titre, setTitre] = useState("");
  const [sujet, setSujet] = useState(`Infos – ${date}`);
  const [corps, setCorps] = useState("Bonjour {prenom},\n\n");
  const [avecAccuse, setAvecAccuse] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [progression, setProgression] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);
  const [textos, setTextos] = useState<{ envoiId: string; destinataires: DestinataireTexto[] } | null>(null);
  const textosPartis = useRef(false);
  const [pending, demarrer] = useTransition();

  const choisis = actifs.filter((r) => selection.has(r.id));
  const fonctions = Array.from(new Set(actifs.map((r) => r.fonction).filter((f): f is string => !!f))).sort();
  const heures = Array.from(new Set(actifs.map((r) => r.heure_convocation?.slice(0, 5)).filter((h): h is string => !!h))).sort();
  const apercu = choisis[0];

  function selectionner(filtre: (r: Row) => boolean) {
    setSelection(new Set(actifs.filter(filtre).map((r) => r.id)));
  }

  function basculer(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function preparer(canal: "email" | "texto") {
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

  function envoyerEmail() {
    setErreur(null);
    const sansEmail = choisis.filter((r) => !r.figurants?.email).length;
    if (!confirm(`Envoyer « ${titre || "ce message"} » par email à ${choisis.length - sansEmail} personne(s) ?`)) return;
    demarrer(async () => {
      const prep = await preparer("email");
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
      setBilan(`✅ ${envoyes} envoyé${envoyes > 1 ? "s" : ""}${echecs > 0 ? ` · ⚠ ${echecs} non envoyé${echecs > 1 ? "s" : ""} (sans email ou erreur)` : ""}.`);
      router.refresh();
    });
  }

  function envoyerTextos() {
    setErreur(null);
    demarrer(async () => {
      const prep = await preparer("texto");
      if (!prep) return;
      setTextos({
        envoiId: prep.envoiId,
        destinataires: choisis.map((r) => {
          const t = prep.tokens[r.figurant_id!];
          return {
            cle: t.id,
            nom: nomComplet(r.figurants),
            telephone: r.figurants?.telephone ?? null,
            texte: texteFinal(corps, r, journeeLieu, avecAccuse, lienRecu(publicOrigin, t.token)),
          };
        }),
      });
    });
  }

  const pret = choisis.length > 0 && titre.trim() && corps.trim();

  return (
    <Modale titre="✉️ Nouveau message" sousTitre="Un message d'info nommé, suivi personne par personne." onClose={onClose} bloquee={pending} large>
      {bilan ? (
        <div className="flex flex-col gap-3 text-sm">
          <p>{bilan}</p>
          {erreur && <p className="text-danger">{erreur}</p>}
          <Button type="button" variant="secondary" onClick={onClose} className="self-start">
            Fermer
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-text-muted">Destinataires ({choisis.length}) :</span>
              {[
                { label: "Tous", f: () => true },
                { label: "Confirmés", f: (r: Row) => r.statut === "confirmé" },
                { label: "Pas encore confirmés", f: (r: Row) => r.statut !== "confirmé" },
                { label: "Aucun", f: () => false },
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => selectionner(c.f)}
                  className="rounded-full border border-border px-2.5 py-1 text-text-muted hover:border-coral/60 hover:text-text"
                >
                  {c.label}
                </button>
              ))}
              {heures.length > 1 &&
                heures.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => selectionner((r) => r.heure_convocation?.slice(0, 5) === h)}
                    className="rounded-full border border-dashed border-border px-2.5 py-1 text-text-muted hover:border-coral/60 hover:text-text"
                  >
                    🕗 {h}
                  </button>
                ))}
              {fonctions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => selectionner((r) => r.fonction === f)}
                  className="rounded-full border border-dashed border-border px-2.5 py-1 text-text-muted hover:border-coral/60 hover:text-text"
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-2">
              {actifs.map((r) => (
                <label key={r.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-ink">
                  <input type="checkbox" checked={selection.has(r.id)} onChange={() => basculer(r.id)} />
                  <span className="flex-1 truncate">{nomComplet(r.figurants)}</span>
                  <span className="text-[11px] text-text-muted">{statutLabel(r.statut)}</span>
                  <span className="text-[11px]" title="Email / téléphone">
                    {r.figurants?.email ? "✉️" : "—"}
                    {telephoneInternational(r.figurants?.telephone ?? null) ? "📱" : "—"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Nom du message (pour le suivi)
            <Input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Parking, Horaire avancé, Tenue…" maxLength={80} />
          </label>

          {templates.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-text-muted">Modèle :</span>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSujet(t.sujet);
                    setCorps(t.corps);
                    if (!titre.trim()) setTitre(t.nom.replace(/^.*·\s*/, ""));
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-text-muted hover:border-coral/60 hover:text-text"
                >
                  {nomModele(t)}
                </button>
              ))}
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            Sujet (email)
            <Input value={sujet} onChange={(e) => setSujet(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Message
            <Textarea rows={8} value={corps} onChange={(e) => setCorps(e.target.value)} />
            <span className="text-xs font-normal text-text-muted">
              {"{prenom} {date} {lieu} {fonction} {cachet} {projet} {signature}"} sont remplacés pour chaque personne.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={avecAccuse} onChange={(e) => setAvecAccuse(e.target.checked)} />
            Demander un accusé de réception (lien « 👍 Bien reçu » en un clic)
          </label>

          {apercu && (
            <div className="rounded-xl border border-border bg-ink p-3 text-sm">
              <p className="mb-1 text-xs text-text-muted">Aperçu — {nomComplet(apercu.figurants)}</p>
              <p className="whitespace-pre-line">
                {texteFinal(corps, apercu, journeeLieu, avecAccuse, lienRecu(publicOrigin, "…"))}
              </p>
            </div>
          )}

          {erreur && <p className="text-sm text-danger">{erreur}</p>}
          {progression && <p className="text-sm text-text-muted">{progression}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" variant="secondary" onClick={envoyerTextos} disabled={pending || !pret}>
              📱 En textos ({choisis.length})
            </Button>
            <Button type="button" onClick={envoyerEmail} disabled={pending || !pret}>
              {pending && progression ? progression : `✉️ Par email (${choisis.length})`}
            </Button>
          </div>
        </div>
      )}

      {textos && (
        <EnvoyerTextos
          destinataires={textos.destinataires}
          ouvertInitial
          sansBouton
          onEnvoye={(cles) => {
            textosPartis.current = true;
            marquerEnvoiTextos(textos.envoiId, cles).then(() => router.refresh());
            setBilan(`✅ ${cles.length} texto${cles.length > 1 ? "s" : ""} parti${cles.length > 1 ? "s" : ""} ou en file.`);
          }}
          onFermer={() => {
            // Fenêtre fermée sans rien envoyer : pas d'envoi vide dans le suivi.
            if (!textosPartis.current) supprimerEnvoi(textos.envoiId).then(() => router.refresh());
            textosPartis.current = false;
            setTextos(null);
          }}
        />
      )}
    </Modale>
  );
}

function EnvoiCarte({
  envoi,
  etatDe,
  rowParFigurant,
  journeeLieu,
  publicOrigin,
}: {
  envoi: EnvoiJournee;
  etatDe: (d: EnvoiDestinataire) => Etat;
  rowParFigurant: Map<string | null | undefined, Row>;
  journeeLieu: string | null;
  publicOrigin: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [pending, demarrer] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [textosRelance, setTextosRelance] = useState<DestinataireTexto[] | null>(null);

  const lignes = trierParNom(
    envoi.destinataires.map((d) => ({ d, r: rowParFigurant.get(d.figurant_id), etat: etatDe(d) })),
    (l) => l.r?.figurants
  );
  const compte = (e: Etat) => lignes.filter((l) => l.etat === e).length;
  const aRelancer = lignes.filter((l) => l.etat === "attente" && l.r);

  function relancer() {
    if (aRelancer.length === 0) return;
    if (envoi.canal === "texto") {
      setTextosRelance(
        aRelancer.map(({ d, r }) => ({
          cle: d.id,
          nom: nomComplet(r!.figurants),
          telephone: r!.figurants?.telephone ?? null,
          texte: `Rappel : ${texteFinal(envoi.corps, r!, journeeLieu, envoi.avec_accuse, lienRecu(publicOrigin, d.token))}`,
        }))
      );
      return;
    }
    if (!confirm(`Relancer par email les ${aRelancer.length} personne(s) sans nouvelles ?`)) return;
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
      setInfo(res.error ?? `🔁 ${res.envoyes} relance${res.envoyes > 1 ? "s" : ""} envoyée${res.envoyes > 1 ? "s" : ""}.`);
      router.refresh();
    });
  }

  function basculerRecu(id: string, recu: boolean) {
    demarrer(async () => {
      await marquerRecu(id, recu);
      router.refresh();
    });
  }

  function supprimer() {
    if (!confirm(`Supprimer le suivi « ${envoi.titre} » ? Les messages déjà envoyés restent dans l'historique des profils.`)) return;
    demarrer(async () => {
      await supprimerEnvoi(envoi.id);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => setOuvert((v) => !v)} className="flex flex-col items-start gap-1 text-left">
          <span className="font-semibold">
            {envoi.canal === "texto" ? "📱" : "✉️"} {envoi.titre} <span className="text-text-muted">{ouvert ? "▾" : "▸"}</span>
          </span>
          <span className="text-xs text-text-muted">
            {formatDateTime(envoi.created_at)} · {envoi.destinataires.length} destinataire{envoi.destinataires.length > 1 ? "s" : ""}
            {envoi.avec_accuse ? " · accusé demandé" : ""}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["recu", "repondu", "attente", "echec", "non_envoye"] as Etat[]).map((e) =>
            compte(e) > 0 ? (
              <Badge key={e} tone={ETATS[e].tone}>
                {ETATS[e].label} {compte(e)}
              </Badge>
            ) : null
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {aRelancer.length > 0 && (
          <Button type="button" variant="secondary" disabled={pending} onClick={relancer}>
            🔁 Relancer les {aRelancer.length} sans nouvelles
          </Button>
        )}
        <button type="button" onClick={supprimer} disabled={pending} className="text-xs text-text-muted hover:text-danger">
          Supprimer ce suivi
        </button>
      </div>
      {info && <p className="text-sm text-turquoise">{info}</p>}

      {ouvert && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <ul className="flex flex-col divide-y divide-border">
            {lignes.map(({ d, r, etat }) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="flex-1">{r ? nomComplet(r.figurants) : "Profil retiré de la journée"}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={ETATS[etat].tone}>{ETATS[etat].label}</Badge>
                  {d.relances > 0 && <span className="text-[11px] text-text-muted">{d.relances} relance{d.relances > 1 ? "s" : ""}</span>}
                  {etat === "echec" && d.erreur && <span className="text-[11px] text-danger">{d.erreur}</span>}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => basculerRecu(d.id, !d.accuse_le)}
                    className={cn("text-[11px] hover:underline", d.accuse_le ? "text-text-muted" : "text-coral")}
                  >
                    {d.accuse_le ? "Annuler" : "Marquer reçu"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-text-muted">Voir le message</summary>
            <p className="mt-2 whitespace-pre-line rounded-xl bg-ink p-3">{envoi.corps}</p>
          </details>
        </div>
      )}

      {textosRelance && (
        <EnvoyerTextos
          destinataires={textosRelance}
          ouvertInitial
          sansBouton
          onEnvoye={(cles) => {
            marquerEnvoiTextos(envoi.id, cles, true).then(() => router.refresh());
            setInfo(`🔁 ${cles.length} relance${cles.length > 1 ? "s" : ""} en textos.`);
          }}
          onFermer={() => setTextosRelance(null)}
        />
      )}
    </Card>
  );
}
