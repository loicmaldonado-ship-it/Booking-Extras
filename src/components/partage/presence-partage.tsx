"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format-date";
import { AccueilVisiteur, useVisiteur } from "@/components/partage/visiteur";
import { commenterPartage, commentairesDuLien, signalerVisitePartage, type CommentairePartage } from "@/lib/partage/suivi";

// À poser sur la page publique d'un lien de partage : demande le prénom et
// le rôle à l'arrivée, signale la présence toutes les 30 s (l'équipe voit
// qui a ouvert le lien et qui est en ligne) et ouvre un fil de
// commentaires avec l'équipe casting.
export function PresencePartage({ token }: { token: string }) {
  // Aperçu ouvert par l'équipe : ni prénom demandé, ni visite comptée.
  const apercu = useSearchParams().get("apercu") === "1";
  const vrai = useVisiteur();
  const moi = apercu ? null : vrai;
  const [ouvert, setOuvert] = useState(false);
  const [commentaires, setCommentaires] = useState<CommentairePartage[]>([]);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const charger = useCallback(() => {
    commentairesDuLien(token).then(setCommentaires);
  }, [token]);

  useEffect(() => {
    if (!moi) return;
    const tic = () => {
      signalerVisitePartage(token, moi.id, moi.prenom, moi.role);
      charger();
    };
    tic();
    const id = setInterval(tic, 30_000);
    return () => clearInterval(id);
  }, [moi, token, charger]);

  function envoyer() {
    if (!moi || !texte.trim()) return;
    setErreur(null);
    startTransition(async () => {
      const res = await commenterPartage(token, moi.id, texte);
      if (res.error) setErreur(res.error);
      else {
        setTexte("");
        charger();
      }
    });
  }

  if (apercu) return null;
  if (!moi) return <AccueilVisiteur />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-coral px-4 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-coral-hover print:hidden"
      >
        💬 Commentaires{commentaires.length > 0 ? ` (${commentaires.length})` : ""}
      </button>
      {ouvert && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-ink/60 print:hidden"
          onMouseDown={(e) => e.target === e.currentTarget && setOuvert(false)}
        >
          <aside aria-label="Commentaires" className="flex h-full w-full max-w-md flex-col gap-3 border-l border-border bg-ink-raised p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">💬 Commentaires pour l&apos;équipe casting</h2>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="flex items-center gap-1 rounded-full border border-border-strong px-3 py-1 text-xs font-medium hover:border-coral/60"
              >
                Fermer <X size={14} />
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Vous : <b className="text-text">{moi.prenom}</b> · {moi.role}
            </p>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {commentaires.length === 0 && <p className="text-sm text-text-muted">Pas encore de commentaire.</p>}
              {commentaires.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    c.equipe ? "self-start bg-coral/10" : "self-end border border-border bg-ink"
                  )}
                >
                  <span className="block text-[11px] text-text-muted">
                    {c.equipe ? `${c.auteur} · équipe casting` : c.auteur} · {formatDateTime(c.created_at)}
                  </span>
                  <span className="whitespace-pre-wrap">{c.texte}</span>
                </div>
              ))}
            </div>
            {erreur && <p className="text-sm text-danger">{erreur}</p>}
            <div className="flex gap-2">
              <textarea
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Un mot pour l'équipe casting…"
                className="flex-1 rounded-lg border border-border-strong bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-coral"
              />
              <button
                type="button"
                onClick={envoyer}
                disabled={pending || !texte.trim()}
                className="self-end rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink hover:bg-coral-hover disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
