"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modale } from "@/components/ui/modale";
import { formatDateLong, formatDateShort } from "@/lib/format-date";
import { dupliquerJournee } from "@/lib/bookings/dupliquer-actions";

// Duplique la journée vers une autre date (infos, besoins, et au choix les
// profils calés).
export function DupliquerJournee({
  projetId,
  date,
  nbProfils,
}: {
  projetId: string;
  date: string;
  nbProfils: number;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [avecProfils, setAvecProfils] = useState(true);
  const [repasserEnPer, setRepasserEnPer] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilan, setBilan] = useState<{ copies: number; dejaLa: number; indispos: number; journeeCreee: boolean } | null>(null);
  const [pending, demarrer] = useTransition();

  function fermer() {
    setOuvert(false);
    setNouvelleDate("");
    setErreur(null);
    setBilan(null);
  }

  function dupliquer() {
    setErreur(null);
    demarrer(async () => {
      const res = await dupliquerJournee(projetId, date, nouvelleDate, { avecProfils: avecProfils && nbProfils > 0, repasserEnPer });
      if (res.error) {
        setErreur(res.error);
        return;
      }
      setBilan({ copies: res.copies ?? 0, dejaLa: res.dejaLa ?? 0, indispos: res.indispos ?? 0, journeeCreee: !!res.journeeCreee });
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOuvert(true)}>
        📋 Dupliquer la journée
      </Button>
      {ouvert && (
        <Modale
          titre="📋 Dupliquer la journée"
          sousTitre={`Copie du ${formatDateLong(date)} : lieu, convocation, besoins${avecProfils ? " et profils" : ""}.`}
          onClose={fermer}
          bloquee={pending}
        >
          {bilan ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>
                ✅ Journée du {formatDateLong(nouvelleDate)} {bilan.journeeCreee ? "créée" : "complétée"}
                {avecProfils && nbProfils > 0
                  ? ` avec ${bilan.copies} profil${bilan.copies > 1 ? "s" : ""}${repasserEnPer ? " en PER" : ""}.`
                  : ", sans profils."}
              </p>
              {bilan.indispos > 0 && (
                <p className="text-yellow">
                  ⚠ {bilan.indispos > 1 ? `${bilan.indispos} ont déclaré` : "1 a déclaré"} une indispo ce jour-là
                  (signalé dans le tableau).
                </p>
              )}
              {bilan.dejaLa > 0 && (
                <p className="text-text-muted">
                  {bilan.dejaLa > 1 ? `${bilan.dejaLa} étaient déjà calé·es` : "1 était déjà calé·e"} à cette date : pas
                  de doublon.
                </p>
              )}
              <Link
                href={`/bookings/documents?projet_id=${projetId}&date=${nouvelleDate}`}
                onClick={fermer}
                className="self-start rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink"
              >
                Ouvrir la journée du {formatDateShort(nouvelleDate)} →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Nouvelle date
                <Input type="date" value={nouvelleDate} onChange={(e) => setNouvelleDate(e.target.value)} disabled={pending} />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={avecProfils && nbProfils > 0}
                  disabled={pending || nbProfils === 0}
                  onChange={(e) => setAvecProfils(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Remettre les profils calés dans cette journée ({nbProfils})
                  <span className="block text-xs text-text-muted">
                    Les annulé·es, indispos et « à rebooker » ne sont pas repris ; ceux déjà calés à la nouvelle date
                    ne sont pas doublés.
                  </span>
                </span>
              </label>
              {avecProfils && nbProfils > 0 && (
                <label className="ml-6 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={repasserEnPer}
                    disabled={pending}
                    onChange={(e) => setRepasserEnPer(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Les passer en PER (à reconfirmer)
                    <span className="block text-xs text-text-muted">Décoché : ils gardent leur statut actuel.</span>
                  </span>
                </label>
              )}
              {erreur && <p className="text-sm text-danger">{erreur}</p>}
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="ghost" onClick={fermer} disabled={pending}>
                  Annuler
                </Button>
                <Button type="button" onClick={dupliquer} disabled={pending || !nouvelleDate}>
                  {pending ? "Duplication…" : "Dupliquer"}
                </Button>
              </div>
            </div>
          )}
        </Modale>
      )}
    </>
  );
}
