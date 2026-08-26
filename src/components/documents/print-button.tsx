"use client";

import { Button } from "@/components/ui/button";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";

export function PrintButton({ lang = DEFAULT_LANG }: { lang?: Lang }) {
  return (
    <Button type="button" className="print-hide" onClick={() => window.print()}>
      {t(lang, "imprimer")}
    </Button>
  );
}
