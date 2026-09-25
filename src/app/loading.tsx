// Affiché immédiatement au clic sur un lien, le temps que la page suivante
// soit prête côté serveur : sans ça, l'ancienne page restait figée et donnait
// l'impression que rien ne se passait.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-label="Chargement">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-56 rounded-lg bg-ink-raised-2 motion-safe:animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-ink-raised-2 motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[64, 88, 72, 96].map((w) => (
          <div key={w} className="h-7 rounded-full bg-ink-raised-2 motion-safe:animate-pulse" style={{ width: w }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[3/4] rounded-xl bg-ink-raised-2 motion-safe:animate-pulse" />
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
