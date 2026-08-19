"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-ink px-4 py-3">
      <code className="flex-1 overflow-x-auto text-sm text-text-muted whitespace-nowrap">{url}</code>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copié !" : "Copier"}
      </Button>
    </div>
  );
}
