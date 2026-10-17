"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format-date";
import { annulerFileTextos, envoyerTextoTest, genererCleRelais, type StatutRelais } from "@/lib/textos/actions";
import { NOM_RACCOURCI } from "@/components/textos/envoyer-textos";

// Mon compte → Textos : installation du raccourci iPhone et du relais Mac.
export function PanneauTextos({ statut, origin }: { statut: StatutRelais | null; origin: string }) {
  const router = useRouter();
  const [cle, setCle] = useState<string | null>(null);
  const [info, setInfo] = useState<{ ok: boolean; texte: string } | null>(null);
  const [copie, setCopie] = useState(false);
  const [pending, demarrer] = useTransition();

  const actif = !!statut?.actif;
  const commande = cle ? `curl -fsSL ${origin}/relais-textos/installer.sh | bash -s -- ${origin} ${cle}` : null;

  function generer() {
    if (statut?.configure && !confirm("Une nouvelle clé désactive le relais déjà installé (il faudra relancer l'installation). Continuer ?")) return;
    setInfo(null);
    demarrer(async () => {
      const res = await genererCleRelais();
      if (res.error) setInfo({ ok: false, texte: res.error });
      else setCle(res.cle ?? null);
      router.refresh();
    });
  }

  async function copierCommande() {
    if (!commande) return;
    await navigator.clipboard.writeText(commande);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  function essai() {
    setInfo(null);
    demarrer(async () => {
      const res = await envoyerTextoTest();
      setInfo(res.error ? { ok: false, texte: res.error } : { ok: true, texte: `Texto d'essai en file vers ${res.numero}.` });
      router.refresh();
    });
  }

  function vider() {
    demarrer(async () => {
      const res = await annulerFileTextos();
      setInfo(res.error ? { ok: false, texte: res.error } : { ok: true, texte: `${res.annules} texto(s) retiré(s) de la file.` });
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-5" id="textos">
      <div>
        <h2 className="text-lg font-semibold">📱 Textos en masse</h2>
        <p className="mt-1 text-sm text-text-muted">
          Envoie des textos personnalisés depuis <strong>ton numéro</strong> (journées, castings…), par ton iPhone ou par
          ton Mac. Les réponses arrivent dans ta messagerie habituelle.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Depuis ton iPhone — raccourci</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            Sur ton iPhone, ouvre{" "}
            <a
              href={`/relais-textos/${encodeURIComponent(NOM_RACCOURCI)}.shortcut`}
              className="font-medium text-coral hover:underline"
            >
              ce raccourci
            </a>{" "}
            puis « Ajouter le raccourci ». Garde son nom : « {NOM_RACCOURCI} ».
          </li>
          <li>
            Au premier envoi, l&apos;iPhone demande s&apos;il peut envoyer des messages : choisis « Toujours
            autoriser ».
          </li>
          <li>Sur le site ouvert dans ton iPhone, « 📱 Envoyer en textos » → « Depuis mon iPhone ».</li>
        </ol>
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer">Le fichier ne s&apos;installe pas ? Le créer à la main</summary>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>App Raccourcis → + → nomme-le « {NOM_RACCOURCI} ».</li>
            <li>« Obtenir le presse-papiers », puis « Obtenir le dictionnaire de l&apos;entrée ».</li>
            <li>« Obtenir la valeur de la clé » : clé « messages ».</li>
            <li>« Répéter avec chaque élément ».</li>
            <li>Dedans : « Obtenir la valeur de la clé » « tel » (sur Élément répété), puis la même avec « texte ».</li>
            <li>
              « Envoyer un message » : message = valeur « texte », destinataire = valeur « tel » ; décoche « Afficher lors de
              l&apos;exécution ».
            </li>
          </ol>
        </details>
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Depuis ton Mac — relais</h3>
          <span className={actif ? "text-sm font-medium text-turquoise" : "text-sm text-text-muted"}>
            {!statut?.configure
              ? "Pas encore installé"
              : actif
                ? "● Relais actif"
                : statut.derniereActivite
                  ? `Relais silencieux depuis le ${formatDateTime(statut.derniereActivite)}`
                  : "Clé créée, relais pas encore lancé"}
          </span>
        </div>
        <p className="text-sm text-text-muted">
          Ton Mac envoie les textos avec l&apos;app Messages, un toutes les 8 à 15 secondes (pour ne pas être pris pour du
          spam par Apple). Il doit rester allumé et connecté à ton compte Apple ; pour les numéros sans iMessage, active
          sur ton iPhone Réglages → Messages → Transfert de SMS → ton Mac.
        </p>
        {commande ? (
          <div className="flex flex-col gap-2 rounded-xl border border-coral/60 bg-ink p-3 text-sm">
            <p>
              Sur ton Mac, ouvre l&apos;app <strong>Terminal</strong>, colle cette commande et appuie sur Entrée (clique
              « OK » si macOS demande l&apos;accès à Messages) :
            </p>
            <code className="break-all rounded-lg bg-ink-raised p-2 text-xs">{commande}</code>
            <Button type="button" onClick={copierCommande} className="self-start">
              {copie ? "Copié !" : "Copier la commande"}
            </Button>
            <p className="text-xs text-text-muted">
              La clé n&apos;est affichée qu&apos;une fois et elle est <strong>à toi</strong> : un·e assistant·e ou
              collègue installe le relais depuis <strong>son propre compte</strong> (Mon compte → Textos), sur son Mac,
              pour envoyer depuis son numéro.
            </p>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={generer} disabled={pending} className="self-start">
            {statut?.configure ? "Réinstaller le relais (nouvelle clé)" : "Installer le relais sur mon Mac"}
          </Button>
        )}
        {statut?.configure && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              En file : <strong>{statut.enAttente}</strong> · envoyés aujourd&apos;hui : <strong>{statut.envoyesAujourdhui}</strong>
              {statut.erreurs > 0 && <span className="text-danger"> · {statut.erreurs} échec(s)</span>}
            </span>
            <Button type="button" variant="ghost" onClick={essai} disabled={pending}>
              Texto d&apos;essai à mon numéro
            </Button>
            {statut.enAttente > 0 && (
              <Button type="button" variant="ghost" onClick={vider} disabled={pending}>
                Vider la file
              </Button>
            )}
          </div>
        )}
        {info && <p className={info.ok ? "text-sm text-turquoise" : "text-sm text-danger"}>{info.texte}</p>}
      </section>
    </Card>
  );
}
