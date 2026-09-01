"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { StatusSelect } from "@/components/ui/status-select";
import { ContactIcons } from "@/components/ui/contact-icons";
import { PreviewButton, type PreviewItem } from "@/components/figurants/figurant-preview-modal";
import { STATUTS, statutTone, type BookingStatut } from "@/lib/bookings/types";
import { removePresentielEntry, updatePresentielStatut } from "@/lib/casting-presentiel/actions";
import type { PresentielEntry } from "@/lib/casting-presentiel/types";

export function PresentielJourneeTable({ rows }: { rows: PresentielEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const previewItems: PreviewItem[] = rows.map((r) => ({
    id: r.figurant_id,
    prenom: r.figurants?.prenom ?? "",
    nom: r.figurants?.nom ?? "",
    ville: null,
    portraitUrl: r.portraitUrl,
  }));

  function remove(id: string) {
    startTransition(async () => {
      await removePresentielEntry(id);
      router.refresh();
    });
  }

  function changeStatut(id: string, statut: BookingStatut) {
    startTransition(async () => {
      await updatePresentielStatut(id, statut);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {rows.map((r, i) => (
        <div
          key={r.id}
          className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-ink-raised p-3 text-center"
        >
          <button
            type="button"
            onClick={() => remove(r.id)}
            disabled={pending}
            className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-text-muted hover:bg-danger hover:text-ink"
            title="Retirer de cette journée"
          >
            ×
          </button>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
            {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
            {r.statut === "valide" && (
              <span
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-turquoise text-xs text-ink"
                title="Validé"
              >
                ✓
              </span>
            )}
          </div>
          <div className="text-sm font-medium">
            {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
          </div>
          {r.casting_roles && <div className="text-[10px] text-coral">{r.casting_roles.nom}</div>}
          <StatusSelect
            value={r.statut}
            tone={statutTone(r.statut)}
            disabled={pending}
            onChange={(e) => changeStatut(r.id, e.target.value as BookingStatut)}
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </StatusSelect>
          <div className="flex items-center gap-1">
            <ContactIcons telephone={r.figurants?.telephone} email={r.figurants?.email} />
            <PreviewButton items={previewItems} index={i} />
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="col-span-full py-10 text-center text-text-muted">Aucun profil pour cette journée.</p>
      )}
    </div>
  );
}
