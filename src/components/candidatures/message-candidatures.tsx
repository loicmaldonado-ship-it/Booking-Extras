"use client";

import { nomComplet, formatPrenom } from "@/lib/noms";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modale } from "@/components/ui/modale";
import { EnvoyerTextos } from "@/components/textos/envoyer-textos";
import { substituteTokens } from "@/lib/bookings/convocation";
import { recordCandidatureMessage } from "@/lib/candidatures/actions";
import { enregistrerDernierMessage, lireDernierMessage } from "@/lib/messages/derniers-actions";
import { projetNomPublic } from "@/lib/projets/types";
import { nomModele, type MessageTemplate } from "@/lib/templates/types";
import type { Row } from "@/components/candidatures/candidatures-table";

const CORPS_VIERGE = "Bonjour {prenom},\n\n";

function tokensDe(r: Row) {
  const projet = r.annonces?.projets;
  return {
    prenom: formatPrenom(r.figurants?.prenom),
    projet: projetNomPublic(projet, "notre projet"),
    lieu: projet?.lieu ?? "",
    cachet: r.cachet_assigne ?? "",
    fonction: r.fonction_assignee ?? "",
    signature: projet?.signature ?? "",
  };
}

// Écrire à une ou plusieurs candidatures, par mail (boîte du projet) ou en
// textos, avec les modèles de l'équipe. {prenom}, {projet}… sont remplacés
// pour chaque personne.
export function MessageCandidatures({
  destinataires,
  templates,
  onClose,
}: {
  destinataires: Row[];
  templates: MessageTemplate[];
  onClose: () => void;
}) {
  const [sujet, setSujet] = useState("Concernant votre candidature");
  const [corps, setCorps] = useState(CORPS_VIERGE);
  const [envoyes, setEnvoyes] = useState<Set<string>>(new Set());
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [confirmer, setConfirmer] = useState(false);
  const [pending, startTransition] = useTransition();
  const plusieurs = destinataires.length > 1;

  // Plusieurs personnes : on reprend le dernier message groupé envoyé.
  useEffect(() => {
    if (!plusieurs) return;
    let annule = false;
    lireDernierMessage("candidatures").then((dernier) => {
      if (annule || !dernier) return;
      if (dernier.sujet) setSujet(dernier.sujet);
      setCorps(dernier.corps);
    });
    return () => {
      annule = true;
    };
  }, [plusieurs]);

  function appliquer(t?: MessageTemplate) {
    setSujet(t ? t.sujet : "Concernant votre candidature");
    setCorps(t ? t.corps : CORPS_VIERGE);
  }

  const avecEmail = destinataires.filter((r) => r.figurants?.email);
  const restants = avecEmail.filter((r) => !envoyes.has(r.id));

  function envoyer(liste: Row[]) {
    setErreurs([]);
    setConfirmer(false);
    startTransition(async () => {
      const ok: string[] = [];
      const ko: string[] = [];
      for (const r of liste) {
        const t = tokensDe(r);
        const res = await recordCandidatureMessage(
          r.figurants!.id,
          substituteTokens(corps, t),
          r.figurants!.email,
          substituteTokens(sujet, t),
          r.annonces?.projet_id
        );
        if (res?.error) ko.push(`${nomComplet(r.figurants)} : ${res.error}`);
        else ok.push(r.id);
      }
      setEnvoyes((prev) => new Set([...prev, ...ok]));
      setErreurs(ko);
      if (ok.length > 0 && plusieurs) enregistrerDernierMessage("candidatures", sujet, corps);
    });
  }

  return (
    <Modale
      titre={plusieurs ? "💬 Message" : `💬 Message à ${nomComplet(destinataires[0]?.figurants)}`}
      sousTitre={plusieurs ? `Pour ${destinataires.length} sélectionné·es` : undefined}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        {templates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">Modèle :</span>
            <button
              type="button"
              onClick={() => appliquer()}
              className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-coral/60"
            >
              Vierge
            </button>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => appliquer(t)}
                className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-coral/60"
              >
                {nomModele(t)}
              </button>
            ))}
          </div>
        )}
        <Input value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Sujet (mail)" aria-label="Sujet" />
        <textarea
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          rows={8}
          autoFocus
          aria-label="Message"
          className="w-full rounded-lg border border-border-strong bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
        />
        <p className="text-xs text-text-muted">
          {"{prenom}"}, {"{projet}"}, {"{lieu}"}, {"{signature}"} sont remplacés pour chaque personne. Le mail part de la
          boîte du projet et la réponse arrive dans la messagerie du profil.
        </p>

        {plusieurs && (
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
            {destinataires.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {nomComplet(r.figurants) || "—"}
                  {!r.figurants?.email && <span className="ml-2 text-xs text-text-muted">pas d&apos;email</span>}
                </span>
                <Button
                  type="button"
                  variant={envoyes.has(r.id) ? "ghost" : "secondary"}
                  disabled={!r.figurants?.email || !corps.trim() || envoyes.has(r.id) || pending}
                  onClick={() => envoyer([r])}
                >
                  {envoyes.has(r.id) ? "✓ Envoyé" : `Envoyer à ${formatPrenom(r.figurants?.prenom)}`}
                </Button>
              </div>
            ))}
          </div>
        )}

        {erreurs.map((e) => (
          <p key={e} className="text-sm text-danger">
            {e}
          </p>
        ))}
        {!plusieurs && envoyes.size > 0 && <p className="text-sm font-medium text-turquoise">✓ Mail envoyé.</p>}

        {confirmer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-coral/50 bg-coral/5 p-2.5 text-sm">
            <span>
              Envoyer ce mail à {restants.length} personne{restants.length > 1 ? "s" : ""} ?
            </span>
            <Button type="button" variant="ghost" onClick={() => setConfirmer(false)}>
              Modifier
            </Button>
            <Button type="button" disabled={pending} onClick={() => envoyer(restants)}>
              {pending ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <EnvoyerTextos
              libelle={`📱 En texto${plusieurs ? `s (${destinataires.length})` : ""}`}
              disabled={!corps.trim()}
              onEnvoye={() => plusieurs && enregistrerDernierMessage("candidatures", sujet, corps)}
              destinataires={destinataires
                .filter((r) => r.figurants)
                .map((r) => ({
                  nom: nomComplet(r.figurants),
                  telephone: r.figurants!.telephone,
                  texte: substituteTokens(corps, tokensDe(r)),
                }))}
            />
            <Button
              type="button"
              disabled={!corps.trim() || restants.length === 0 || pending}
              onClick={() => (plusieurs ? setConfirmer(true) : envoyer(restants))}
            >
              {pending ? "Envoi…" : plusieurs ? `✉️ Mail à tous (${restants.length})` : "✉️ Envoyer le mail"}
            </Button>
          </div>
        )}
      </div>
    </Modale>
  );
}
