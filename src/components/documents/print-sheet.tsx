import { cn } from "@/lib/cn";

// A4 at 96dpi: 794x1123 portrait, 1123x794 landscape — keeps on-screen
// preview and the captured canvas at the true page aspect ratio.
export function PrintSheet({
  children,
  orientation = "portrait",
  fixedHeight = false,
  className,
}: {
  children: React.ReactNode;
  orientation?: "portrait" | "landscape";
  fixedHeight?: boolean;
  className?: string;
}) {
  return (
    <div
      data-print-sheet
      className={cn(
        "mx-auto max-w-full rounded-2xl bg-white p-8 text-black shadow-xl print:rounded-none print:p-0 print:shadow-none",
        orientation === "landscape" ? "w-[1123px]" : "w-[794px]",
        fixedHeight && (orientation === "landscape" ? "h-[794px] overflow-hidden" : "h-[1123px] overflow-hidden"),
        className
      )}
    >
      {orientation === "landscape" && <style>{"@page { size: landscape; }"}</style>}
      {children}
    </div>
  );
}
