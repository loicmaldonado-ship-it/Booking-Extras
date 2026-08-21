import Link from "next/link";
import { cn } from "@/lib/cn";
import { SORT_DIMENSIONS, type Dimension, type DocSort } from "@/lib/documents/sort";

// Tri additif par clic : cliquer une puce l'ajoute en dernière position du
// tri, la recliquer la retire. Le numéro affiché est l'ordre d'application
// (1 = critère de groupement principal, 2 = affine chaque groupe, etc.).
export function SortChips({
  baseParams,
  current,
  sortParam = "sort",
}: {
  baseParams: Record<string, string | string[] | undefined>;
  current: DocSort;
  sortParam?: string;
}) {
  function hrefFor(dims: Dimension[]) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(baseParams)) {
      if (key === sortParam || value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) sp.append(key, v);
      } else {
        sp.set(key, value);
      }
    }
    for (const dim of dims) sp.append(sortParam, dim);
    return `?${sp.toString()}`;
  }

  return (
    <div className="print-hide flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-ink-raised px-4 py-3 text-sm">
      <span className="text-text-muted">Trier par :</span>
      {SORT_DIMENSIONS.map((d) => {
        const idx = current.indexOf(d.key);
        const active = idx !== -1;
        const nextDims = active ? current.filter((x) => x !== d.key) : [...current, d.key];
        return (
          <Link
            key={d.key}
            href={hrefFor(nextDims)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-coral bg-coral/15 text-coral"
                : "border-border text-text-muted hover:text-text"
            )}
          >
            {active ? `${idx + 1}. ` : ""}
            {d.label}
          </Link>
        );
      })}
      {current.length > 0 && (
        <Link href={hrefFor([])} className="text-xs text-text-muted hover:text-text hover:underline">
          Réinitialiser
        </Link>
      )}
    </div>
  );
}
