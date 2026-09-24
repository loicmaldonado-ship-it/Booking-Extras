import { cn } from "@/lib/cn";

export function HabitueBadge({ tournages, className }: { tournages: number; className?: string }) {
  if (tournages <= 0) return null;
  return (
    <span
      className={cn("rounded-full bg-yellow/15 px-2 py-0.5 text-[10px] font-medium text-yellow", className)}
      title="Nombre de tournages différents où cette personne a été confirmée"
    >
      Habitué·e · {tournages} tournage{tournages > 1 ? "s" : ""}
    </span>
  );
}
