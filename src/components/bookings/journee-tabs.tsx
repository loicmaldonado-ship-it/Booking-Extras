"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BookingsTable, type Row, type StaffMessageRow } from "@/components/bookings/bookings-table";
import { EssayagesPanel, type EssayageRow, type BookedFigurant } from "@/components/bookings/essayages-panel";
import { CovoiturageBoard, type CovoiturageRow } from "@/components/bookings/covoiturage-board";
import { ExportMyroleButtons } from "@/components/bookings/export-myrole-buttons";
import { BesoinsPanel } from "@/components/bookings/besoins-panel";
import { ConvocationSettingsPanel } from "@/components/bookings/convocation-settings-panel";
import { PartageJourneeButton } from "@/components/partage/partage-journee-button";
import type { MessageTemplate } from "@/lib/templates/types";
import type { JourneeBesoin } from "@/lib/bookings/besoins";
import type { ConvocationSettings } from "@/lib/bookings/convocation";
import type { InboxReply } from "@/lib/email/inbox";

const TABS = [
  { value: "bookings", label: "Bookings" },
  { value: "essayage", label: "Essayage" },
  { value: "covoiturage", label: "Covoiturage" },
  { value: "documents", label: "Documents" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function JourneeTabs({
  bookings,
  templates,
  essayageFigurants,
  essayages,
  covoiturageRows,
  projetId,
  date,
  besoins,
  journeeId,
  totalRequis,
  journeeLieu,
  projetLieu,
  convocationSettings,
  initialReplies,
  messagesByFigurant,
  journeePartage,
  publicOrigin,
}: {
  bookings: Row[];
  templates: MessageTemplate[];
  essayageFigurants: BookedFigurant[];
  essayages: EssayageRow[];
  covoiturageRows: CovoiturageRow[];
  projetId: string;
  date: string;
  besoins: JourneeBesoin[];
  journeeId: string | null;
  totalRequis: number | null;
  journeeLieu: string | null;
  projetLieu: string | null;
  convocationSettings: ConvocationSettings;
  initialReplies: InboxReply[];
  messagesByFigurant: Record<string, StaffMessageRow[]>;
  journeePartage: { token: string; showContacts: boolean } | null;
  publicOrigin: string;
}) {
  const [tab, setTab] = useState<Tab>("bookings");
  const query = `?projet_id=${projetId}&date=${date}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.value
                ? "border-coral text-text"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bookings" && (
        <div className="flex flex-col gap-4">
          {journeeId && (
            <BesoinsPanel besoins={besoins} bookings={bookings} journeeId={journeeId} totalRequis={totalRequis} />
          )}
          {journeeId && (
            <ConvocationSettingsPanel
              journeeId={journeeId}
              lieu={journeeLieu}
              projetLieu={projetLieu}
              precisions={convocationSettings.precisions ?? null}
              hmc={convocationSettings.hmc ?? null}
              accessoires={convocationSettings.accessoires ?? null}
              commentaires={convocationSettings.commentaires ?? null}
            />
          )}
          <BookingsTable
            rows={bookings}
            projetId={projetId}
            date={date}
            templates={templates}
            journeeLieu={journeeLieu}
            convocationSettings={convocationSettings}
            initialReplies={initialReplies}
            messagesByFigurant={messagesByFigurant}
          />
        </div>
      )}

      {tab === "essayage" && (
        <EssayagesPanel figurants={essayageFigurants} essayages={essayages} projetId={projetId} />
      )}

      {tab === "covoiturage" && <CovoiturageBoard rows={covoiturageRows} date={date} />}

      {tab === "documents" && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text-muted">Documents & export</h2>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/bookings/documents/liste-appel${query}`} variant="secondary">
              Liste d&apos;appel
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/trombis${query}`} variant="secondary">
              Trombis
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/fiches${query}`} variant="secondary">
              Fiches mensuration
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/bordereau${query}`} variant="secondary">
              Bordereau d&apos;émargement
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/covoiturage${query}`} variant="secondary">
              Résumé covoiturage
            </ButtonLink>
          </div>
          <ExportMyroleButtons projetId={projetId} date={date} />
          <PartageJourneeButton
            projetId={projetId}
            date={date}
            initialToken={journeePartage?.token ?? null}
            initialShowContacts={journeePartage?.showContacts ?? false}
            publicBaseUrl={`${publicOrigin}/partage/documents`}
          />
        </Card>
      )}
    </div>
  );
}
