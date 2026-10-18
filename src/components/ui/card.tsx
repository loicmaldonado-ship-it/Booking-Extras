import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-ink-raised p-6",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "default",
  ...props
}: ComponentProps<"span"> & {
  tone?: "default" | "coral" | "turquoise" | "confirme" | "yellow" | "danger" | "indispo";
}) {
  const tones = {
    default: "bg-ink-raised-2 text-text-muted",
    coral: "bg-coral/15 text-coral",
    turquoise: "bg-turquoise/15 text-turquoise",
    confirme: "bg-turquoise font-semibold text-white",
    yellow: "bg-yellow/15 text-yellow",
    danger: "bg-danger/15 text-danger",
    indispo: "bg-danger font-semibold text-white",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
