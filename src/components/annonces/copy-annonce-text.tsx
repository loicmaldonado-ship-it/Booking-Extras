"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyAnnonceText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copié !" : "Copier l'annonce"}
    </Button>
  );
}
