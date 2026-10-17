"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Modale } from "@/components/ui/modale";
import { inviterAuCasting, modeleInvitationCasting } from "@/lib/casting/invitations-actions";

const PAQUET = 20;

// Copie un texte, y compris quand il arrive d'une requête (Safari iOS exige
// que l'écriture parte du clic : ClipboardItem accepte une promesse).
export async function copierTexte(texte: string | Promise<string>) {
  try {
    if (typeof texte !== "string" && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": texte.then((t) => new Blob([t], { type: "text/plain" })) }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(await texte);
    return true;
  } catch {
    window.prompt("Copie ce message :", await texte);
    return false;
  }
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Colle une liste d'emails (une par ligne, ou séparées par virgules /
// points-virgules / espaces) : tout le monde reçoit le lien rapide du rôle.
function lireEmails(texte: string) {
  const vus = new Set<string>();
  const valides: string[] = [];
  const invalides: string[] = [];
  for (const brut of texte.split(/[\s,;]+/)) {
    const e = brut.trim().replace(/^<|>$/g, "").toLowerCase();
    if (!e || vus.has(e)) continue;
    vus.add(e);
    if (EMAIL_RE.test(e)) valides.push(e);
    else invalides.push(brut.trim());
  }
  return { valides, invalides };
}

export function InviterCasting({ roleId, roleNom, lien }: { roleId: string; roleNom: string; lien: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [listeBrute, setListeBrute] = useState("");
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [dejaInvites, setDejaInvites] = useState<Set<string>>(new Set());
  const [renvoyer, setRenvoyer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [progression, setProgression] = useState<string | null>(null);
  const [bilan, setBilan] = useState<{ envoyes: number; echecs: { email: string; raison: string }[] } | null>(null);
  const [pending, demarrer] = useTransition();
  const [texteCopie, setTexteCopie] = useState(false);

  async function copierEnTexto() {
    if (await copierTexte(corps.replaceAll("{lien}", lien))) {
      setTexteCopie(true);
      setTimeout(() => setTexteCopie(false), 2000);
    }
  }

  const { valides, invalides } = useMemo(() => lireEmails(listeBrute), [listeBrute]);
  const aEnvoyer = renvoyer ? valides : valides.filter((e) => !dejaInvites.has(e));
  const ignores = valides.length - aEnvoyer.length;

  async function ouvrir() {
    setOuvert(true);
    setBilan(null);
    setErreur(null);
    setChargement(true);
    const res = await modeleInvitationCasting(roleId);
    setChargement(false);
    if (res.error) {
      setErreur(res.error);
      return;
    }
    setSujet(res.sujet ?? "");
    setCorps(res.corps ?? "");
    setDejaInvites(new Set(res.dejaInvites ?? []));
  }

  function fermer() {
    if (pending) return;
    setOuvert(false);
    setListeBrute("");
    setRenvoyer(false);
    setProgression(null);
  }

  function envoyer() {
    if (aEnvoyer.length === 0) return;
    if (!confirm(`Envoyer l'invitation à ${aEnvoyer.length} adresse${aEnvoyer.length > 1 ? "s" : ""} ?`)) return;
    setErreur(null);
    demarrer(async () => {
      let envoyes = 0;
      const echecs: { email: string; raison: string }[] = [];
      for (let i = 0; i < aEnvoyer.length; i += PAQUET) {
        setProgression(`Envoi… ${envoyes}/${aEnvoyer.length}`);
        const res = await inviterAuCasting(roleId, aEnvoyer.slice(i, i + PAQUET), sujet, corps);
        if (res.error) {
          setErreur(res.error);
          break;
        }
        envoyes += res.envoyes.length;
        echecs.push(...res.echecs);
      }
      setProgression(null);
      if (envoyes > 0 || echecs.length > 0) setBilan({ envoyes, echecs });
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        className="rounded-full border border-coral px-3 py-1 text-xs font-semibold text-coral hover:bg-coral/10"
      >
        ✉️ Inviter par email
      </button>
      {ouvert && (
        <Modale
          titre={`✉️ Inviter au casting « ${roleNom} »`}
          sousTitre="Pour des personnes pas encore dans la base : elles reçoivent le lien, créent leur compte et envoient photos et vidéos."
          onClose={fermer}
          bloquee={pending}
          large
        >
          {chargement ? (
            <p className="text-sm text-text-muted">Chargement…</p>
          ) : bilan ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>
                ✅ {bilan.envoyes} invitation{bilan.envoyes > 1 ? "s" : ""} envoyée{bilan.envoyes > 1 ? "s" : ""}.
                Chaque personne apparaîtra dans le rôle dès qu&apos;elle aura répondu.
              </p>
              {bilan.echecs.length > 0 && (
                <div className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-danger">
                  Non envoyées :
                  <ul className="mt-1 list-disc pl-5">
                    {bilan.echecs.map((e) => (
                      <li key={e.email}>
                        {e.email} — {e.raison}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {erreur && <p className="text-danger">{erreur}</p>}
              <Button type="button" variant="secondary" onClick={fermer} className="self-start">
                Fermer
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Emails
                <Textarea
                  rows={5}
                  value={listeBrute}
                  onChange={(e) => setListeBrute(e.target.value)}
                  placeholder={"prenom.nom@gmail.com\nautre@exemple.fr, encore@exemple.fr"}
                  disabled={pending}
                />
                <span className="text-xs font-normal text-text-muted">
                  Une par ligne, ou séparées par des virgules. Tu peux coller une colonne Excel.
                </span>
              </label>
              {(valides.length > 0 || invalides.length > 0) && (
                <div className="flex flex-col gap-1 text-sm">
                  <span>
                    <strong>{aEnvoyer.length}</strong> à inviter
                    {ignores > 0 && <span className="text-text-muted"> · {ignores} déjà invité·e{ignores > 1 ? "s" : ""}</span>}
                  </span>
                  {invalides.length > 0 && (
                    <span className="text-danger">
                      Ignoré{invalides.length > 1 ? "s" : ""} (pas une adresse) : {invalides.join(", ")}
                    </span>
                  )}
                  {ignores > 0 && (
                    <label className="flex items-center gap-2 text-xs text-text-muted">
                      <input type="checkbox" checked={renvoyer} onChange={(e) => setRenvoyer(e.target.checked)} />
                      Renvoyer aussi aux personnes déjà invitées
                    </label>
                  )}
                </div>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium">
                Objet
                <Input value={sujet} onChange={(e) => setSujet(e.target.value)} disabled={pending} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Message
                <Textarea rows={11} value={corps} onChange={(e) => setCorps(e.target.value)} disabled={pending} />
                <span className="text-xs font-normal text-text-muted">
                  {"{lien}"} est remplacé par le lien du casting — garde-le dans le message.
                </span>
              </label>
              {erreur && <p className="text-sm text-danger">{erreur}</p>}
              {progression && <p className="text-sm text-text-muted">{progression}</p>}
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="ghost" onClick={fermer} disabled={pending}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copierEnTexto}
                  disabled={!corps.trim()}
                  title="Copie le message avec le lien, à coller dans un SMS / WhatsApp"
                >
                  {texteCopie ? "Copié !" : "📱 Copier en texto"}
                </Button>
                <Button
                  type="button"
                  onClick={envoyer}
                  disabled={pending || aEnvoyer.length === 0 || !corps.includes("{lien}") || !sujet.trim()}
                >
                  {pending ? "Envoi…" : `Envoyer à ${aEnvoyer.length}`}
                </Button>
              </div>
            </div>
          )}
        </Modale>
      )}
    </>
  );
}
