"use client";

import { useState } from "react";

// Mail (Mac) n'a pas d'URL publique pour ouvrir une recherche pré-remplie —
// on copie donc l'adresse pour un collage manuel dans la recherche Mail.
export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = email;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        // Aucun mécanisme de copie disponible dans ce navigateur.
      }
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Copier pour coller dans la recherche Mail"
      className="text-xs text-coral hover:underline"
    >
      {copied ? "Copié !" : "Copier (pour Mail)"}
    </button>
  );
}
