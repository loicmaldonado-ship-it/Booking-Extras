import { Fragment } from "react";
import Image from "next/image";
import { pickPortrait, type FigurantPhotoWithUrl } from "@/lib/documents/data";
import { computeAge, type DocumentField } from "@/lib/documents/fields";
import type { TrombiItem } from "@/lib/documents/trombi";

export function TrombiGrid({
  items,
  selectedFields,
  photosByFigurant,
  projetId,
  showHmc = false,
}: {
  items: TrombiItem[];
  selectedFields: Set<DocumentField>;
  photosByFigurant: Map<string, FigurantPhotoWithUrl[]>;
  projetId: string;
  showHmc?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {items.map((item, index) => {
        const showHeader = item.headerLabel !== null && (index === 0 || item.headerLabel !== items[index - 1].headerLabel);
        const portrait = pickPortrait(photosByFigurant.get(item.booking.figurant.id), projetId);
        const age = computeAge(item.booking.figurant.date_naissance);
        const aboveLines = [
          selectedFields.has("fonction") && item.booking.fonction ? item.booking.fonction : null,
          selectedFields.has("age") && age !== null ? `${age} ans` : null,
          selectedFields.has("sexe") && item.booking.figurant.genre ? item.booking.figurant.genre : null,
          selectedFields.has("pronom") && item.booking.figurant.pronom ? item.booking.figurant.pronom : null,
        ].filter((l): l is string => !!l);

        return (
          <Fragment key={item.booking.id}>
            {showHeader && (
              <div className="mt-1 w-full border-b border-gray-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 first:mt-0">
                {item.headerLabel}
              </div>
            )}
            <div className="flex w-24 flex-col items-center gap-0.5 text-center">
              {aboveLines.length > 0 && (
                <div className="flex flex-col leading-tight text-[8px] text-gray-600">
                  {aboveLines.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </div>
              )}
              <div className="relative h-32 w-24 overflow-hidden rounded bg-gray-100">
                {portrait?.url && (
                  <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">
                {item.badge ? `${item.badge} ` : ""}
                {item.booking.figurant.prenom} {item.booking.figurant.nom}
              </span>
              {selectedFields.has("ville") && item.booking.figurant.ville && (
                <span className="text-[8px] leading-tight text-gray-500">{item.booking.figurant.ville}</span>
              )}
              {selectedFields.has("telephone") && item.booking.figurant.telephone && (
                <span className="text-[8px] leading-tight text-gray-500">{item.booking.figurant.telephone}</span>
              )}
              {selectedFields.has("email") && item.booking.figurant.email && (
                <span className="max-w-24 truncate text-[8px] leading-tight text-gray-500">
                  {item.booking.figurant.email}
                </span>
              )}
              {showHmc && (
                <div className="mt-0.5 flex gap-2 text-[8px] font-medium text-gray-700">
                  {["H", "M", "C"].map((label) => (
                    <span key={label} className="flex items-center gap-0.5">
                      <span className="inline-block h-2.5 w-2.5 border border-gray-500" />
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
