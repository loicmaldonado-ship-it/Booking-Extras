"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Clapperboard, Megaphone } from "lucide-react";
import { searchGlobal, type SearchResult } from "@/lib/search/actions";
import { cn } from "@/lib/cn";

const KIND_ICON = { figurant: Users, projet: Clapperboard, annonce: Megaphone } as const;
const KIND_LABEL = { figurant: "Profil", projet: "Projet", annonce: "Annonce" } as const;

// Recherche rapide (⌘K) pour naviguer sans repasser par le menu — utile vu le
// nombre de sections quand on vit dans l'appli toute la journée.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  function openPalette() {
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) setOpen(false);
        else openPalette();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      searchGlobal(query).then((r) => {
        setResults(r);
        setActiveIndex(0);
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  function go(result: SearchResult) {
    setOpen(false);
    router.push(result.href);
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      go(results[activeIndex]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text-muted transition-colors hover:border-coral/60 hover:text-text"
      >
        <Search size={16} strokeWidth={1.75} />
        <span className="hidden sm:inline">Rechercher</span>
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted sm:inline">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/60 px-4 pt-[15vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-ink-raised shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={18} strokeWidth={1.75} className="text-text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Chercher un profil, un projet, une annonce..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {loading && <p className="px-3 py-4 text-center text-sm text-text-muted">Recherche...</p>}
              {!loading && query.trim().length >= 2 && results.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-text-muted">Aucun résultat.</p>
              )}
              {!loading &&
                results.map((r, i) => {
                  const Icon = KIND_ICON[r.kind];
                  return (
                    <button
                      key={`${r.kind}-${r.id}`}
                      type="button"
                      onClick={() => go(r)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        i === activeIndex ? "bg-ink-raised-2 text-text" : "text-text-muted hover:bg-ink-raised-2/60"
                      )}
                    >
                      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                      <span className="flex-1 truncate">
                        <span className="font-medium text-text">{r.label}</span>
                        {r.sublabel && <span className="text-text-muted"> — {r.sublabel}</span>}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-muted">
                        {KIND_LABEL[r.kind]}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
