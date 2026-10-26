"use client";

import { cn } from "@/lib/cn";
import { Children, cloneElement, isValidElement, useId, type ComponentProps, type ReactElement } from "react";

const fieldBase =
  "w-full rounded-xl border border-border bg-ink px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 outline-none transition-colors focus:border-coral";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium text-text-muted", className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, className)} {...props} />;
}

export function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  const generatedId = useId();
  const fields = Children.toArray(children);
  const control = fields.find((child): child is ReactElement<{ id?: string }> =>
    isValidElement<{ id?: string }>(child) &&
    [Input, Textarea, Select, "input", "textarea", "select"].includes(child.type as typeof Input)
  );
  const controlId = control ? control.props.id || generatedId : undefined;
  const controls = fields.map((child) => child === control
    ? cloneElement(control, { id: controlId })
    : child);
  return (
    <div>
      <Label htmlFor={controlId}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </Label>
      {controls}
    </div>
  );
}
