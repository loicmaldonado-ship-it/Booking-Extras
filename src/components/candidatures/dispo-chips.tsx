import { cn } from "@/lib/cn";
import { formatDayMonth } from "@/lib/format-date";

// Une pastille par date recherchée : verte si dispo, rouge barrée sinon.
export function DispoChips({
  dates,
  size = "sm",
  className,
}: {
  dates: { date: string; disponible: boolean }[];
  size?: "sm" | "lg";
  className?: string;
}) {
  if (dates.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {dates.map((d) => (
        <span
          key={d.date}
          title={d.disponible ? "Disponible" : "Pas disponible"}
          className={cn(
            "rounded font-medium tabular-nums",
            size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-sm",
            d.disponible ? "bg-turquoise/15 text-turquoise" : "bg-danger/10 text-danger line-through"
          )}
        >
          {formatDayMonth(d.date)}
        </span>
      ))}
    </div>
  );
}

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
