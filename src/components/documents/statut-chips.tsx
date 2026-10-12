import Link from "next/link";
import { cn } from "@/lib/cn";
import { DOC_STATUTS, type DocStatut } from "@/lib/documents/statuts";

// Pastilles « qui sortir » d'un document de journée (trombis, fiches).
export function StatutChips({
  baseParams,
  current,
}: {
  baseParams: Record<string, string | string[] | undefined>;
  current: DocStatut;
}) {
  function hrefFor(key: DocStatut) {
    const sp = new URLSearchParams();
    for (const [k, value] of Object.entries(baseParams)) {
      if (k === "statut" || value === undefined) continue;
      for (const v of Array.isArray(value) ? value : [value]) sp.append(k, v);
    }
    sp.set("statut", key);
    return `?${sp.toString()}`;
  }

  return (
    <div className="print-hide flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Qui :</span>
      {DOC_STATUTS.map((s) => (
        <Link
          key={s.key}
          href={hrefFor(s.key)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            current === s.key ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
