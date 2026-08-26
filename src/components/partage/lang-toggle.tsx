import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Lang } from "@/lib/i18n/partage";

// Bascule FR/EN sur les pages de partage public — un simple lien qui
// rejoue l'URL avec ?lang=xx, pour rester utilisable côté impression/PDF
// sans JS. Les autres paramètres déjà présents (date, fields...) doivent
// être passés explicitement pour ne pas les perdre au changement de langue.
export function LangToggle({
  lang,
  basePath,
  otherParams,
}: {
  lang: Lang;
  basePath: string;
  otherParams?: Record<string, string | undefined>;
}) {
  function hrefFor(target: Lang) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(otherParams ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("lang", target);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="print-hide flex items-center overflow-hidden rounded-full border border-border text-xs font-medium">
      <Link
        href={hrefFor("fr")}
        className={cn("px-2.5 py-1", lang === "fr" ? "bg-coral text-ink" : "text-text-muted hover:text-text")}
      >
        FR
      </Link>
      <Link
        href={hrefFor("en")}
        className={cn("px-2.5 py-1", lang === "en" ? "bg-coral text-ink" : "text-text-muted hover:text-text")}
      >
        EN
      </Link>
    </div>
  );
}
