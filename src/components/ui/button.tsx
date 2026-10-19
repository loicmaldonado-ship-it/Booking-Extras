import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold text-sm px-5 py-2.5 transition-colors disabled:opacity-40 disabled:pointer-events-none";

const variants = {
  // Boutons francs, visibles d'un coup d'œil : plein (action principale),
  // cerclé noir (secondaire), cerclé neutre (annuler / retour).
  primary: "bg-coral text-ink shadow-sm hover:bg-coral-hover",
  secondary: "bg-ink text-coral border-2 border-text shadow-sm hover:bg-coral/10",
  ghost: "bg-ink/70 text-text border border-border-strong hover:border-text",
  turquoise: "bg-turquoise text-ink shadow-sm hover:brightness-110",
  danger: "bg-danger text-ink shadow-sm hover:brightness-110",
};

type Variant = keyof typeof variants;

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  href,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link href={href} className={cn(base, variants[variant], className)} {...props} />
  );
}

// Plain <a> tag for real browser navigations (file downloads) — next/link's
// client-side routing can interfere with Content-Disposition: attachment.
export function AnchorButton({
  className,
  variant = "primary",
  ...props
}: ComponentProps<"a"> & { variant?: Variant }) {
  return <a className={cn(base, variants[variant], className)} {...props} />;
}
