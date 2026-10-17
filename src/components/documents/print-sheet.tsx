import { FeuilleAjustee } from "@/components/documents/feuille-ajustee";
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
  // Le format papier garde toujours sa vraie largeur (sinon la grille
  // change de colonnes et le contenu déborde, perdu à la capture PDF) : sur
  // un écran étroit, la feuille entière est réduite à l'affichage (zoom),
  // jamais recoupée ni remise en page.
  return (
    <FeuilleAjustee largeur={orientation === "landscape" ? 1123 : 794}>
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
    </FeuilleAjustee>
  );
}
