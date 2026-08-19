import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium text-sm px-5 py-2.5 transition-colors disabled:opacity-40 disabled:pointer-events-none";

const variants = {
  primary: "bg-coral text-ink hover:bg-coral-hover",
  secondary: "bg-ink-raised-2 text-text border border-border hover:border-coral/60",
  ghost: "text-text-muted hover:text-text hover:bg-ink-raised",
  turquoise: "bg-turquoise text-ink hover:brightness-110",
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
