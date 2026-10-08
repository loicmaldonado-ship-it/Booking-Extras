"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { formatDateLong, formatDateShort } from "@/lib/format-date";
import { VARIABLES_PDT } from "@/lib/bookings/pdt";
import {
  apercuModificationPdt,
  modifierPdt,
  prevenirProfilsPdt,
  supprimerJourneeBasculee,
  type ApercuPdt,
} from "@/lib/bookings/pdt-actions";

const PAQUET_MESSAGES = 20;

// Modification du plan de travail : bascule toute la journée vers une autre
// date (journée miroir, profils « À REBOOKER »), avec ou sans message.
export function ModifierPdt({
  projetId,
  date,
  modeleInitial,
}: {
  projetId: string;
  date: string;
  modeleInitial: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [apercu, setApercu] = useState<ApercuPdt | null>(null);
  const [prevenir, setPrevenir] = useState(true);
  const [parEmail, setParEmail] = useState(false);
  const [modele, setModele] = useState(modeleInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [progression, setProgression] = useState<string | null>(null);
  const [bilan, setBilan] = useState<{ basculees: number; indispos: number; dejaLa: number; envoyes: number; echecs: string[] } | null>(
    null
  );
  const [pending, demarrer] = useTransition();

  function fermer() {
    if (pending) return;
    setOuvert(false);
    setNouvelleDate("");
    setApercu(null);
    setErreur(null);
    setBilan(null);
    setProgression(null);
  }

  function choisirDate(valeur: string) {
    setNouvelleDate(valeur);
    setApercu(null);
    setErreur(null);
    if (!valeur) return;
    demarrer(async () => {
      const res = await apercuModificationPdt(projetId, date, valeur);
      if (res.error || !res.data) setErreur(res.error ?? "Aperçu impossible.");
      else setApercu(res.data);
    });
  }

  function basculer() {
    if (!apercu) return;
    demarrer(async () => {
      setErreur(null);
      setProgression("Bascule en cours…");
      const res = await modifierPdt(projetId, date, nouvelleDate, prevenir ? modele : null);
      if (res.error || !res.miroirIds) {
        setErreur(res.error ?? "Bascule impossible.");
        setProgression(null);
        return;
      }
      let envoyes = 0;
      const echecs: string[] = [];
      if (prevenir && res.miroirIds.length > 0) {
        for (let i = 0; i < res.miroirIds.length; i += PAQUET_MESSAGES) {
          setProgression(`Messages envoyés : ${envoyes}/${res.miroirIds.length}…`);
          const envoi = await prevenirProfilsPdt(
            projetId,
            date,
            nouvelleDate,
            modele,
            res.miroirIds.slice(i, i + PAQUET_MESSAGES),
            parEmail
          );
          if (envoi.error) {
            echecs.push(envoi.error);
            break;
          }
          envoyes += envoi.envoyes;
          echecs.push(...envoi.echecs);
        }
      }
      setProgression(null);
      setBilan({ basculees: res.basculees ?? 0, indispos: res.indispos ?? 0, dejaLa: res.dejaLa ?? 0, envoyes, echecs });
      router.refresh();
    });
  }

  const lienNouvelle = `/bookings/documents?projet_id=${projetId}&date=${nouvelleDate}`;

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOuvert(true)}>
        🔀 Modifier le PDT
      </Button>
      {ouvert &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Modifier le plan de travail"
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
            onClick={fermer}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-ink-raised p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Modifier le PDT</h3>
                  <p className="text-sm text-text-muted">
                    Bascule la journée du <strong>{formatDateLong(date)}</strong> vers une nouvelle date. Tout le monde y
                    réapparaît en <strong>À REBOOKER</strong> ; les autres journées ne bougent pas.
                  </p>
                </div>
                <button type="button" onClick={fermer} className="text-sm text-text-muted hover:text-text">
                  Fermer
                </button>
              </div>

              {bilan ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm">
                    ✅ <strong>{bilan.basculees}</strong> profil{bilan.basculees > 1 ? "s" : ""} en À REBOOKER le{" "}
                    {formatDateLong(nouvelleDate)}.
                  </p>
                  {bilan.indispos > 0 && (
                    <p className="text-sm text-yellow">
                      ⚠ {bilan.indispos} ont déclaré une indispo ce jour-là (signalé·es dans le tableau).
                    </p>
                  )}
                  {bilan.dejaLa > 0 && (
                    <p className="text-sm text-text-muted">{bilan.dejaLa} étaient déjà calé·es à la nouvelle date : non touché·es.</p>
                  )}
                  {prevenir && (
                    <p className="text-sm text-text-muted">
                      {bilan.envoyes} message{bilan.envoyes > 1 ? "s" : ""} envoyé{bilan.envoyes > 1 ? "s" : ""}.
                    </p>
                  )}
                  {bilan.echecs.length > 0 && (
                    <p className="text-sm text-danger">Non envoyés : {bilan.echecs.join(", ")}</p>
                  )}
                  <p className="text-xs text-text-muted">
                    Dès que tu changes le statut d&apos;un profil sur la nouvelle journée (CONFIRMÉ, Indisponible…), il
                    disparaît de l&apos;ancienne. Quand tout le monde est traité, tu peux supprimer l&apos;ancienne journée.
                  </p>
                  <Link
                    href={lienNouvelle}
                    onClick={() => setOuvert(false)}
                    className="self-start rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Ouvrir la journée du {formatDateShort(nouvelleDate)} →
                  </Link>
                </div>
              ) : (
                <>
                  <label className="flex flex-col gap-1 text-sm font-medium">
                    Nouvelle date
                    <Input type="date" value={nouvelleDate} onChange={(e) => choisirDate(e.target.value)} disabled={pending} />
                  </label>

                  {apercu && (
                    <ul className="flex flex-col gap-1 rounded-xl border border-border bg-ink px-4 py-3 text-sm">
                      <li>
                        <strong>{apercu.aBasculer}</strong> profil{apercu.aBasculer > 1 ? "s" : ""} basculé
                        {apercu.aBasculer > 1 ? "s" : ""} en À REBOOKER
                        {apercu.nouvelleExiste ? " (journée existante)" : " (nouvelle journée créée)"}
                      </li>
                      {apercu.indispos > 0 && (
                        <li className="text-yellow">⚠ dont {apercu.indispos} avec une indispo déclarée ce jour-là</li>
                      )}
                      {apercu.dejaLa > 0 && (
                        <li className="text-text-muted">{apercu.dejaLa} déjà calé·es à cette date : non touché·es</li>
                      )}
                      {apercu.dejaEnCours > 0 && (
                        <li className="text-text-muted">{apercu.dejaEnCours} déjà en cours de rebooking : ignoré·es</li>
                      )}
                      {apercu.annules > 0 && <li className="text-text-muted">{apercu.annules} annulé·es : ignoré·es</li>}
                    </ul>
                  )}

                  {apercu && apercu.aBasculer > 0 && (
                    <>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={prevenir} onChange={(e) => setPrevenir(e.target.checked)} />
                        Prévenir les profils (message dans leur espace + notification)
                      </label>
                      {prevenir && (
                        <div className="flex flex-col gap-2">
                          <Textarea rows={9} value={modele} onChange={(e) => setModele(e.target.value)} />
                          <p className="text-xs text-text-muted">
                            Variables : {VARIABLES_PDT.join(" ")} — ce message est gardé pour les prochaines
                            modifications du projet.
                          </p>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={parEmail} onChange={(e) => setParEmail(e.target.checked)} />
                            Envoyer aussi par e-mail (boîte Gmail du projet)
                          </label>
                        </div>
                      )}
                      {!prevenir && (
                        <p className="text-xs text-text-muted">
                          Aucun message : les profils passent juste en À REBOOKER sur la nouvelle journée.
                        </p>
                      )}
                    </>
                  )}

                  {erreur && <p className="text-sm text-danger">{erreur}</p>}
                  {progression && <p className="text-sm text-text-muted">{progression}</p>}

                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      type="button"
                      disabled={pending || !apercu || apercu.aBasculer === 0 || (prevenir && modele.trim() === "")}
                      onClick={basculer}
                    >
                      {pending && progression
                        ? "Bascule…"
                        : !apercu || apercu.aBasculer === 0
                          ? "Basculer"
                          : `Basculer ${apercu.aBasculer} profil${apercu.aBasculer > 1 ? "s" : ""}${prevenir ? " et prévenir" : ""}`}
                    </Button>
                    <Button type="button" variant="secondary" onClick={fermer} disabled={pending}>
                      Annuler
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// Bandeau de l'ancienne journée après une modification du PDT.
export function BandeauJourneeBasculee({
  projetId,
  date,
  pdtVers,
  enAttente,
  restants,
}: {
  projetId: string;
  date: string;
  pdtVers: string;
  enAttente: number;
  restants: number;
}) {
  const router = useRouter();
  const [pending, demarrer] = useTransition();

  function supprimer() {
    const detail = restants > 0 ? ` et ses ${restants} booking${restants > 1 ? "s" : ""} restant${restants > 1 ? "s" : ""}` : "";
    if (!confirm(`Supprimer la journée du ${formatDateShort(date)}${detail} ?`)) return;
    demarrer(async () => {
      const res = await supprimerJourneeBasculee(projetId, date);
      if (res.error) alert(res.error);
      else router.push(`/bookings/documents?projet_id=${projetId}&date=${pdtVers}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm">
      <p>
        🔀 PDT modifié : journée basculée au{" "}
        <Link href={`/bookings/documents?projet_id=${projetId}&date=${pdtVers}`} className="font-semibold text-coral hover:underline">
          {formatDateLong(pdtVers)}
        </Link>
        .{" "}
        {enAttente > 0
          ? `${enAttente} profil${enAttente > 1 ? "s" : ""} encore À REBOOKER là-bas — chacun·e disparaît d'ici une fois son statut changé.`
          : `Tout le monde a été traité sur la nouvelle date${
              restants > 0 ? ` (reste ici ${restants} booking${restants > 1 ? "s" : ""} : déjà calé·es là-bas ou annulé·es)` : ""
            }.`}
      </p>
      {enAttente === 0 && (
        <Button type="button" variant="secondary" onClick={supprimer} disabled={pending}>
          {pending ? "Suppression…" : "Supprimer cette journée"}
        </Button>
      )}
    </div>
  );
}
