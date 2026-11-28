"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { AgentNomInput } from "@/components/agents/agent-nom-input";
import { envoyerLiensAgents, type ResultatEnvoiAgent } from "@/lib/casting/agents-actions";
import { CORPS_AGENT_PAR_DEFAUT, SUJET_AGENT_PAR_DEFAUT } from "@/lib/casting/agents-mail";
import { cn } from "@/lib/cn";

export type LienAgentEnvoi = {
  id: string;
  baseId: string | null;
  nom: string;
  agence: string | null;
  email: string | null;
  actif: boolean;
  dernierEnvoi: string | null;
};

type Ajoute = { baseId: string; nom: string; agence: string | null; email: string | null };

// Envoi groupé : on coche les agents du projet, on ajoute d'autres agents de la base, et le
// lien personnel de chacun part par email (créé au passage s'il n'existe pas encore).
export function EnvoiAgents({ projetId, liens }: { projetId: string; liens: LienAgentEnvoi[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [ajoutes, setAjoutes] = useState<Ajoute[]>([]);
  const [recherche, setRecherche] = useState("");
  const [sujet, setSujet] = useState(SUJET_AGENT_PAR_DEFAUT);
  const [corps, setCorps] = useState(CORPS_AGENT_PAR_DEFAUT);
  const [repliques, setRepliques] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultats, setResultats] = useState<ResultatEnvoiAgent[] | null>(null);

  const envoyables = liens.filter((l) => l.actif && l.email);
  const dejaLiesBase = new Set(liens.map((l) => l.baseId).filter(Boolean));
  const ajoutesUtiles = ajoutes.filter((a) => !dejaLiesBase.has(a.baseId));
  const total = coches.size + ajoutesUtiles.filter((a) => a.email).length;

  function basculer(id: string) {
    setCoches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function ajouterDepuisBase(a: { id: string; nom: string; agence: string | null; email: string | null }) {
    setRecherche("");
    const lien = liens.find((l) => l.baseId === a.id);
    if (lien) {
      // Déjà un lien sur ce projet : on le coche simplement.
      if (lien.actif && lien.email) setCoches((prev) => new Set(prev).add(lien.id));
      return;
    }
    setAjoutes((prev) => (prev.some((x) => x.baseId === a.id) ? prev : [...prev, { baseId: a.id, nom: a.nom, agence: a.agence, email: a.email }]));
  }

  function envoyer() {
    setErreur(null);
    setResultats(null);
    const cibles = [
      ...Array.from(coches).map((lienId) => ({ lienId })),
      ...ajoutesUtiles.filter((a) => a.email).map((a) => ({ baseId: a.baseId })),
    ];
    const noms = [
      ...liens.filter((l) => coches.has(l.id)).map((l) => l.nom),
      ...ajoutesUtiles.filter((a) => a.email).map((a) => a.nom),
    ];
    if (cibles.length === 0) return;
    if (!window.confirm(`Envoyer le lien par email à ${cibles.length} agent${cibles.length > 1 ? "s" : ""} ?\n\n${noms.join("\n")}`)) return;
    startTransition(async () => {
      const res = await envoyerLiensAgents(projetId, cibles, sujet, corps, repliques);
      if (res.error) return setErreur(res.error);
      const liste = res.resultats ?? [];
      setResultats(liste);
      // Les agents bien envoyés sortent de la sélection.
      const ok = new Set(liste.filter((r) => r.ok).map((r) => r.nom));
      setCoches((prev) => new Set(Array.from(prev).filter((id) => !ok.has(liens.find((l) => l.id === id)?.nom ?? ""))));
      setAjoutes((prev) => prev.filter((a) => !ok.has(a.nom)));
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h3 className="text-base font-semibold">✉️ Envoyer les liens par email</h3>
        <p className="text-xs text-text-muted">
          Coche les agents de ce projet, ajoute-en d&apos;autres depuis ta base, et chacun reçoit son lien personnel.
        </p>
      </div>

      {liens.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Agents de ce projet</span>
            <button
              type="button"
              className="rounded-full border-2 border-border-strong px-3 py-0.5 text-xs font-semibold hover:border-coral"
              onClick={() => setCoches(coches.size === envoyables.length ? new Set() : new Set(envoyables.map((l) => l.id)))}
              disabled={envoyables.length === 0}
            >
              {coches.size === envoyables.length && envoyables.length > 0 ? "Tout décocher" : `Tout cocher (${envoyables.length})`}
            </button>
          </div>
          {liens.map((l) => {
            const bloque = !l.actif || !l.email;
            return (
              <label key={l.id} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-raised-2", bloque && "opacity-50")}>
                <input type="checkbox" className="accent-coral" disabled={bloque} checked={coches.has(l.id)} onChange={() => basculer(l.id)} />
                <span className="font-medium">{l.nom}</span>
                {l.agence && <span className="text-text-muted">{l.agence}</span>}
                <span className="text-xs text-text-muted">
                  {!l.actif ? "lien coupé" : !l.email ? "pas d'email" : l.email}
                </span>
                {l.dernierEnvoi && (
                  <span className="ml-auto text-xs text-text-muted">envoyé le {new Date(l.dernierEnvoi).toLocaleDateString("fr-FR")}</span>
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Ajouter un agent de ta base</span>
        <AgentNomInput
          value={recherche}
          onChange={setRecherche}
          onSelect={ajouterDepuisBase}
          placeholder="Tape un nom pour chercher"
          className="w-full rounded-xl border border-border bg-ink px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 outline-none transition-colors focus:border-coral"
        />
        {ajoutesUtiles.map((a) => (
          <div key={a.baseId} className="flex items-center gap-2 rounded-lg bg-ink-raised-2 px-2 py-1.5 text-sm">
            <span className="font-medium">{a.nom}</span>
            {a.agence && <span className="text-text-muted">{a.agence}</span>}
            <span className="text-xs text-text-muted">{a.email ?? "pas d'email : ne recevra rien"}</span>
            <button
              type="button"
              onClick={() => setAjoutes((prev) => prev.filter((x) => x.baseId !== a.baseId))}
              className="ml-auto text-xs font-semibold text-text-muted hover:text-danger"
              aria-label={`Retirer ${a.nom}`}
            >
              ✕ Retirer
            </button>
          </div>
        ))}
      </div>

      <Input value={sujet} onChange={(e) => setSujet(e.target.value)} aria-label="Objet du mail" />
      <Textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={9} aria-label="Message" />
      <p className="-mt-1 text-xs text-text-muted">
        {"{agent}"}, {"{projet}"}, {"{lien}"} et {"{signature}"} sont remplacés pour chaque agent.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={repliques} onChange={(e) => setRepliques(e.target.checked)} className="accent-coral" />
        Les liens créés à cet envoi montrent aussi les répliques d&apos;essai
      </label>

      {erreur && <p className="text-sm text-danger">{erreur}</p>}
      <div>
        <Button type="button" onClick={envoyer} disabled={pending || total === 0}>
          {pending ? "Envoi en cours…" : total === 0 ? "Choisis au moins un agent" : `Envoyer à ${total} agent${total > 1 ? "s" : ""}`}
        </Button>
      </div>

      {resultats && (
        <ul className="flex flex-col gap-1 text-sm">
          {resultats.map((r, i) => (
            <li key={i} className={r.ok ? "text-turquoise" : "text-danger"}>
              {r.ok ? "✓" : "✕"} {r.nom} — {r.message}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
