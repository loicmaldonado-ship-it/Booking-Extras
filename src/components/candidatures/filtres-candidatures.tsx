"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { AGES, ORDRES } from "@/lib/candidatures/filtres";

const menu =
  "rounded-full border px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:border-coral";
const menuOff = "border-border-strong bg-ink text-text hover:border-coral/60";
const menuOn = "border-coral bg-coral/15 text-coral";

// Une seule barre : recherche, genre, âge, dispo, question, « Plus de
// filtres » (le reste, formulaire rendu par la page), tri et vue. Chaque
// choix met à jour l'adresse (la page refiltre côté serveur) et revient à
// la première page de résultats.
export function FiltresCandidatures({
  genres,
  dates,
  questions,
  etiquettes,
  plusActifs,
  plus,
}: {
  genres: { value: string; label: string }[];
  dates: { id: string; label: string }[];
  questions: { id: string; label: string }[];
  etiquettes: { id: string; label: string }[];
  // Nombre de filtres actifs dans « Plus de filtres ».
  plusActifs: number;
  plus: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [plusOuvert, setPlusOuvert] = useState(false);
  const qUrl = params.get("q") ?? "";
  const [q, setQ] = useState(qUrl);
  const [qSync, setQSync] = useState(qUrl);
  const [qEnvoye, setQEnvoye] = useState(qUrl);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Recherche effacée d'ailleurs (puce « × », « Tout effacer ») : le champ
  // suit. Pas quand c'est notre propre frappe qui revient dans l'adresse.
  if (qSync !== qUrl) {
    setQSync(qUrl);
    if (qUrl !== qEnvoye) setQ(qUrl);
  }

  function aller(maj: Record<string, string | null>, remplacer = false) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(maj)) {
      sp.delete(k);
      if (v) sp.set(k, v);
    }
    sp.delete("page");
    const url = `${pathname}?${sp.toString()}`;
    if (remplacer) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }

  function chercher(valeur: string) {
    setQ(valeur);
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      setQEnvoye(valeur.trim());
      aller({ q: valeur.trim() || null }, true);
    }, 350);
  }
  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  const genre = params.get("genre") ?? "";
  const ageMin = params.get("age_min") ?? "";
  const ageMax = params.get("age_max") ?? "";
  const age = AGES.find((a) => a.min === ageMin && a.max === ageMax)?.value ?? (ageMin || ageMax ? "perso" : "");
  const dispos = params.getAll("dispo");
  const dispo = dispos.length === 1 ? dispos[0] : dispos.length > 1 ? "plusieurs" : "";
  const etiquettesChoisies = params.getAll("etiquette");
  const etiquette = etiquettesChoisies.length === 1 ? etiquettesChoisies[0] : etiquettesChoisies.length > 1 ? "plusieurs" : "";
  const questionId = params.get("question_id") ?? "";
  const reponse = params.get("question_reponse") ?? "";
  const question = questionId ? `${questionId}|${reponse || "oui"}` : "";
  const ordre = params.get("ordre") ?? "recentes";
  const vue = params.get("vue") === "liste" ? "liste" : "trombi";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-ink-raised p-2">
        <label className="flex min-w-[13rem] flex-1 items-center gap-2 rounded-full border border-border-strong bg-ink px-3 py-1.5 focus-within:border-coral sm:max-w-xs">
          <Search size={14} className="shrink-0 text-text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => chercher(e.target.value)}
            placeholder="Prénom, nom ou email…"
            aria-label="Chercher par prénom, nom ou email"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted/70 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => chercher("")} aria-label="Effacer la recherche" className="text-text-muted hover:text-text">
              <X size={14} />
            </button>
          )}
        </label>

        <div className="flex overflow-hidden rounded-full border border-border-strong" role="group" aria-label="Genre">
          {[{ value: "", label: "Tous" }, ...genres].map((g) => (
            <button
              key={g.value || "tous"}
              type="button"
              onClick={() => aller({ genre: g.value || null })}
              aria-pressed={genre === g.value}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                genre === g.value ? "bg-coral/15 text-coral" : "text-text hover:bg-ink-raised-2"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Âge"
          value={age}
          onChange={(e) => {
            const a = AGES.find((x) => x.value === e.target.value);
            aller({ age_min: a?.min || null, age_max: a?.max || null });
          }}
          className={cn(menu, age ? menuOn : menuOff)}
        >
          <option value="">Âge : tous</option>
          {AGES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
          {age === "perso" && (
            <option value="perso">
              Âge : {ageMin || "…"}–{ageMax || "…"}
            </option>
          )}
        </select>

        {dates.length > 0 && (
          <select
            aria-label="Disponible le"
            value={dispo}
            onChange={(e) => aller({ dispo: e.target.value || null })}
            className={cn(menu, dispo ? menuOn : menuOff)}
          >
            <option value="">Dispo : tous les jours</option>
            {dates.map((d) => (
              <option key={d.id} value={d.id}>
                Dispo le {d.label}
              </option>
            ))}
            {dispo === "plusieurs" && <option value="plusieurs">Dispo : plusieurs dates</option>}
          </select>
        )}

        {etiquettes.length > 0 && (
          <select
            aria-label="Étiquette"
            value={etiquette}
            onChange={(e) => aller({ etiquette: e.target.value || null })}
            className={cn(menu, etiquette ? menuOn : menuOff)}
          >
            <option value="">🏷️ Étiquette : toutes</option>
            {etiquettes.map((e) => (
              <option key={e.id} value={e.id}>
                🏷️ {e.label}
              </option>
            ))}
            {etiquette === "plusieurs" && <option value="plusieurs">🏷️ Plusieurs étiquettes</option>}
          </select>
        )}

        {questions.length > 0 && (
          <select
            aria-label="Question"
            value={question}
            onChange={(e) => {
              const [id, rep] = e.target.value.split("|");
              aller({ question_id: id || null, question_reponse: id ? rep : null });
            }}
            className={cn(menu, "max-w-[16rem]", question ? menuOn : menuOff)}
          >
            <option value="">Question : toutes</option>
            {questions.flatMap((qu) => [
              <option key={`${qu.id}|oui`} value={`${qu.id}|oui`}>
                {qu.label} : oui
              </option>,
              <option key={`${qu.id}|non`} value={`${qu.id}|non`}>
                {qu.label} : non
              </option>,
            ])}
          </select>
        )}

        <button
          type="button"
          onClick={() => setPlusOuvert((v) => !v)}
          aria-expanded={plusOuvert}
          className={cn(menu, plusActifs > 0 ? menuOn : menuOff)}
        >
          {plusOuvert ? "－" : "＋"} Plus de filtres{plusActifs > 0 ? ` (${plusActifs})` : ""}
        </button>

        <span className="hidden flex-1 lg:block" />

        <select
          aria-label="Trier"
          value={ordre}
          onChange={(e) => aller({ ordre: e.target.value === "recentes" ? null : e.target.value })}
          className={cn(menu, menuOff)}
        >
          {ORDRES.map((o) => (
            <option key={o.key} value={o.key}>
              Trier : {o.label}
            </option>
          ))}
        </select>

        <div className="flex overflow-hidden rounded-full border border-border-strong" role="group" aria-label="Affichage">
          {(
            [
              ["trombi", "🖼️ Trombi"],
              ["liste", "☰ Liste"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => aller({ vue: v === "liste" ? "liste" : null }, true)}
              aria-pressed={vue === v}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                vue === v ? "bg-coral/15 text-coral" : "text-text hover:bg-ink-raised-2"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {plusOuvert && plus}
    </div>
  );
}
