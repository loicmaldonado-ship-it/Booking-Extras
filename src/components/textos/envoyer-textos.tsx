"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modale } from "@/components/ui/modale";
import { telephoneInternational, type DestinataireTexto } from "@/lib/textos/telephone";
import { mettreEnFileTextos } from "@/lib/textos/actions";

export const NOM_RACCOURCI = "Booking Extras Textos";

// Envoi de textos en masse, chacun personnalisé :
// - depuis l'iPhone : la liste est copiée, puis le raccourci « Booking
//   Extras Textos » les envoie un par un (site ouvert sur l'iPhone) ;
// - depuis le Mac : mis en file, le relais du Mac les envoie avec Messages.
export function EnvoyerTextos({
  destinataires,
  libelle = "📱 Envoyer en textos",
  disabled = false,
  onEnvoye,
}: {
  destinataires: DestinataireTexto[];
  libelle?: string;
  disabled?: boolean;
  // Appelé une fois les textos partis / mis en file (ex. garder le message).
  onEnvoye?: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [pending, demarrer] = useTransition();

  const valides = destinataires
    .map((d) => ({ ...d, tel: telephoneInternational(d.telephone) }))
    .filter((d): d is DestinataireTexto & { tel: string } => !!d.tel && !!d.texte.trim());
  const sansNumero = destinataires.filter((d) => !telephoneInternational(d.telephone)).map((d) => d.nom);

  async function depuisIphone() {
    setMessage(null);
    const liste = JSON.stringify({ messages: valides.map((d) => ({ tel: d.tel, texte: d.texte })) });
    try {
      await navigator.clipboard.writeText(liste);
    } catch {
      setMessage({ ok: false, texte: "Impossible de copier la liste sur cet appareil." });
      return;
    }
    setMessage({
      ok: true,
      texte: `Liste de ${valides.length} texto${valides.length > 1 ? "s" : ""} copiée : le raccourci les envoie.`,
    });
    onEnvoye?.();
    window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(NOM_RACCOURCI)}`;
  }

  function depuisMac() {
    setMessage(null);
    if (!confirm(`Envoyer ${valides.length} texto${valides.length > 1 ? "s" : ""} depuis ton Mac ?`)) return;
    demarrer(async () => {
      const res = await mettreEnFileTextos(valides.map((d) => ({ nom: d.nom, telephone: d.tel, texte: d.texte })));
      if (res.error) {
        setMessage({ ok: false, texte: res.error });
        return;
      }
      onEnvoye?.();
      setMessage({
          ok: true,
          texte: `${res.enFile} texto${res.enFile > 1 ? "s" : ""} en file : ton Mac les envoie un par un (environ 10 s d'écart).`,
        });
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || destinataires.length === 0}
        onClick={() => {
          setMessage(null);
          setOuvert(true);
        }}
      >
        {libelle}
      </Button>
      {ouvert && (
        <Modale
          titre="📱 Envoyer en textos"
          sousTitre={`${valides.length} texto${valides.length > 1 ? "s" : ""} personnalisé${valides.length > 1 ? "s" : ""}, depuis ton numéro.`}
          onClose={() => setOuvert(false)}
          bloquee={pending}
        >
          {sansNumero.length > 0 && (
            <p className="text-sm text-danger">
              Sans numéro de portable valable (ignoré{sansNumero.length > 1 ? "s" : ""}) : {sansNumero.join(", ")}
            </p>
          )}
          {valides[0] && (
            <div className="rounded-xl border border-border bg-ink p-3 text-sm">
              <p className="mb-1 text-xs text-text-muted">Aperçu — {valides[0].nom}</p>
              <p className="whitespace-pre-line">{valides[0].texte}</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <Button type="button" onClick={depuisIphone} disabled={valides.length === 0}>
                📱 Depuis mon iPhone
              </Button>
              <p className="text-xs text-text-muted">
                Site ouvert sur ton iPhone : la liste est copiée et le raccourci les envoie. Le raccourci
                s&apos;installe une fois (Mon compte → Textos).
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <Button type="button" variant="secondary" onClick={depuisMac} disabled={pending || valides.length === 0}>
                {pending ? "Mise en file…" : "💻 Depuis mon Mac"}
              </Button>
              <p className="text-xs text-text-muted">
                Ton Mac (allumé, relais installé) les envoie avec Messages, même si tu es sur ton téléphone.
              </p>
            </div>
          </div>
          {message && <p className={message.ok ? "text-sm text-turquoise" : "text-sm text-danger"}>{message.texte}</p>}
          <Link href="/mon-compte#textos" className="text-xs text-coral hover:underline">
            Installer / vérifier le raccourci iPhone et le relais Mac →
          </Link>
        </Modale>
      )}
    </>
  );
}
