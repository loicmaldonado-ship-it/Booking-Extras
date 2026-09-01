"use client";

import { useEffect, useRef, useState } from "react";
import { searchAgents } from "@/lib/agents/actions";
import type { Agent } from "@/lib/agents/types";

// Champ "Nom de l'agent" avec autocomplete sur la base commune — sélectionner
// une suggestion remplit aussi les champs liés (agence, email, téléphone) via
// onSelect, pour ne pas retaper un agent déjà rentré une fois ailleurs.
export function AgentNomInput({
  name,
  value,
  onChange,
  onSelect,
  className,
  placeholder = "Nom de l'agent",
}: {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (agent: Agent) => void;
  className?: string;
  placeholder?: string;
}) {
  const [results, setResults] = useState<Agent[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const queryTooShort = value.trim().length < 2;

  useEffect(() => {
    if (queryTooShort) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const found = await searchAgents(value);
      if (!cancelled) setResults(found);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [value, queryTooShort]);

  const visibleResults = queryTooShort ? [] : results;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {open && visibleResults.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-lg border border-border bg-ink-raised-2 shadow-xl">
          {visibleResults.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onSelect(a);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-ink-raised"
            >
              <span className="font-medium">{a.nom}</span>
              {a.agence && <span className="text-text-muted"> · {a.agence}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
