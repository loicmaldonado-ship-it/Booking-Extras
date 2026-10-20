"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format-date";
import { lireSuiviPartage, repondrePartage, type SuiviPartage, type TypeLienSuivi } from "@/lib/partage/suivi";

// Sous un lien de partage, côté équipe : qui l'a ouvert, qui est en ligne,
// et le fil de commentaires avec réponse. Rafraîchi toutes les 30 s.
export function SuiviPartageLien({ projetId, type, date, categorie = null }: { projetId: string; type: TypeLienSuivi; date?: string; categorie?: string | null }) {
  const [suivi, setSuivi] = useState<SuiviPartage | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [reponse, setReponse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const charger = useCallback(() => {
    lireSuiviPartage(projetId, type, date, categorie).then((res) => {
      if ("error" in res) setErreur(res.error);
      else setSuivi(res);
    });
  }, [projetId, type, date, categorie]);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 30_000);
    return () => clearInterval(id);
  }, [charger]);

  function repondre() {
    if (!reponse.trim()) return;
    setErreur(null);
    startTransition(async () => {
      const res = await repondrePartage(projetId, type, reponse, date, categorie);
      if (res.error) setErreur(res.error);
      else {
        setReponse("");
        charger();
      }
    });
  }

  if (!suivi) return erreur ? <p className="text-xs text-danger">{erreur}</p> : null;
  const enLigne = suivi.visites.filter((v) => v.enLigne).length;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-ink p-2.5 text-sm">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-left text-xs"
      >
        <span>
          👁 {suivi.visites.length === 0
            ? "Personne ne l'a encore ouvert"
            : `${suivi.visites.length} personne${suivi.visites.length > 1 ? "s l'ont" : " l'a"} ouvert`}
        </span>
        {enLigne > 0 && (
          <span className="flex items-center gap-1 font-medium text-turquoise">
            <span className="h-2 w-2 rounded-full bg-turquoise" /> {enLigne} en ligne
          </span>
        )}
        <span>💬 {suivi.commentaires.length}</span>
        <span className="ml-auto font-medium text-coral">{ouvert ? "Replier" : "Voir qui et les commentaires"}</span>
      </button>

      {ouvert && (
        <div className="grid gap-3 border-t border-border pt-2 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <b className="text-xs text-text-muted">👁 Qui a ouvert le lien</b>
            {suivi.visites.length === 0 && <span className="text-xs text-text-muted">Personne pour l&apos;instant.</span>}
            {suivi.visites.map((v) => (
              <div key={v.visiteur_id} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", v.enLigne ? "bg-turquoise" : "bg-border-strong")} />
                  <b>{v.prenom}</b>
                  {v.role && <span className="text-text-muted">· {v.role}</span>}
                </span>
                <span className="text-text-muted">
                  {v.enLigne ? <b className="text-turquoise">En ligne</b> : `vu ${formatDateTime(v.derniere_vue)}`}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <b className="text-xs text-text-muted">💬 Commentaires</b>
            {suivi.commentaires.length === 0 && <span className="text-xs text-text-muted">Aucun commentaire.</span>}
            {suivi.commentaires.map((c) => (
              <div
                key={c.id}
                className={cn("max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs", c.equipe ? "self-end bg-coral/10" : "self-start border border-border bg-ink-raised")}
              >
                <span className="block text-[10px] text-text-muted">
                  {c.auteur} · {formatDateTime(c.created_at)}
                </span>
                {c.profil && <span className="block text-[11px] font-semibold text-coral">↳ {c.profil}</span>}
                  <span className="whitespace-pre-wrap">{c.texte}</span>
              </div>
            ))}
            <div className="flex gap-1.5">
              <input
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && repondre()}
                placeholder="Répondre…"
                className="min-w-0 flex-1 rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-xs outline-none focus:border-coral"
              />
              <button
                type="button"
                onClick={repondre}
                disabled={pending || !reponse.trim()}
                className="rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-coral/60 disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
            {erreur && <p className="text-xs text-danger">{erreur}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
