import { cn } from "@/lib/cn";

// A4 at 96dpi: 794x1123 portrait, 1123x794 landscape — keeps on-screen
// preview and the captured canvas at the true page aspect ratio.
export function PrintSheet({
  children,
  orientation = "portrait",
  fixedHeight = false,
  className,
  pageLabel,
}: {
  children: React.ReactNode;
  orientation?: "portrait" | "landscape";
  fixedHeight?: boolean;
  className?: string;
  // "3 / 15" imprimé en coin de page — utile pour retrouver l'ordre d'un
  // document multi-pages une fois imprimé/mélangé.
  pageLabel?: string;
}) {
  // Le format papier ne doit jamais rétrécir pour tenir dans une fenêtre
  // étroite : ça fausse le nombre de colonnes de la grille (flex-wrap) et
  // fait déborder le contenu hors du cadre — silencieusement perdu à la
  // capture PDF (overflow-hidden). Le conteneur défile plutôt que la page
  // ne rétrécisse.
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <div
        data-print-sheet
        className={cn(
          "relative mx-auto rounded-2xl bg-white p-8 text-black shadow-xl print:mx-0 print:rounded-none print:p-0 print:shadow-none",
          orientation === "landscape" ? "w-[1123px]" : "w-[794px]",
          fixedHeight && (orientation === "landscape" ? "h-[794px] overflow-hidden" : "h-[1123px] overflow-hidden"),
          className
        )}
      >
        {orientation === "landscape" && <style>{"@page { size: landscape; }"}</style>}
        {children}
        {pageLabel && (
          <span className="absolute bottom-3 right-4 text-[10px] text-gray-400">{pageLabel}</span>
        )}
      </div>
    </div>
  );
}
