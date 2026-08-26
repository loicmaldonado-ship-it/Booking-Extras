import Image from "next/image";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";

export function DocumentLetterhead({
  societe,
  filmNom,
  dateLabel,
  realisateur,
  logoUrl,
  accentColor,
  lang = DEFAULT_LANG,
}: {
  societe: string | null;
  filmNom: string;
  dateLabel: string;
  realisateur?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  lang?: Lang;
}) {
  return (
    <div
      className="mb-4 flex items-start justify-between gap-4 border-b-2 pb-2"
      style={{ borderColor: accentColor || "transparent" }}
    >
      <div className="flex items-center gap-3">
        {logoUrl && (
          <div className="relative h-10 w-20 shrink-0">
            <Image src={logoUrl} alt="" fill className="object-contain object-left" unoptimized />
          </div>
        )}
        <div className="text-xs font-semibold uppercase text-gray-700">{societe}</div>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold uppercase" style={{ color: accentColor || undefined }}>
          {filmNom}
        </h2>
        <p className="text-sm text-gray-600">{dateLabel}</p>
      </div>
      <div className="text-right text-xs text-gray-700">
        <div className="font-semibold uppercase">{filmNom}</div>
        {realisateur && <div>{t(lang, "real")} : {realisateur}</div>}
      </div>
    </div>
  );
}
