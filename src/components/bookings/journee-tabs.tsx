"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BookingsTable, type Row, type MessageRow } from "@/components/bookings/bookings-table";
import { EssayagesPanel, type EssayageRow, type BookedFigurant } from "@/components/bookings/essayages-panel";
import { CovoiturageBoard, type CovoiturageRow } from "@/components/bookings/covoiturage-board";
import { ExportMyroleButtons } from "@/components/bookings/export-myrole-buttons";
import { BesoinsPanel } from "@/components/bookings/besoins-panel";
import { ConvocationSettingsPanel } from "@/components/bookings/convocation-settings-panel";
import { PartageJourneeButton } from "@/components/partage/partage-journee-button";
import { MessagesJournee } from "@/components/messages/messages-journee";
import type { EnvoiJournee } from "@/lib/messages/envois";
import type { MessageTemplate } from "@/lib/templates/types";
import type { JourneeBesoin } from "@/lib/bookings/besoins";
import type { ConvocationSettings } from "@/lib/bookings/convocation";
import type { InboxReply } from "@/lib/email/inbox";
import type { ProjetIndemnite } from "@/lib/indemnites/types";
import type { BaremeMajoration } from "@/lib/bareme/types";

const TABS = [
  { value: "bookings", label: "📋 Bookings" },
  { value: "essayage", label: "👗 Essayage" },
  { value: "covoiturage", label: "🚗 Covoiturage" },
  { value: "messages", label: "💬 Messages" },
  { value: "documents", label: "📄 Documents" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function JourneeTabs({
  bookings,
  canExport = false,
  templates,
  essayageFigurants,
  essayages,
  covoiturageRows,
  projetId,
  fonctionsProjet,
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
  covoiturageTarifBase,
  covoiturageTarifPassager,
  autresDates,
  projetIndemnites,
  baremeMajorations,
  envois = [],
}: {
  bookings: Row[];
  canExport?: boolean;
  templates: MessageTemplate[];
  essayageFigurants: BookedFigurant[];
  essayages: EssayageRow[];
  covoiturageRows: CovoiturageRow[];
  projetId: string;
  fonctionsProjet: string[];
  date: string;
  besoins: JourneeBesoin[];
  journeeId: string | null;
  totalRequis: number | null;
  journeeLieu: string | null;
  projetLieu: string | null;
  convocationSettings: ConvocationSettings;
  initialReplies: InboxReply[];
  messagesByFigurant: Record<string, MessageRow[]>;
  journeePartage: { token: string; showContacts: boolean } | null;
  publicOrigin: string;
  covoiturageTarifBase?: number;
  covoiturageTarifPassager?: number;
  autresDates?: string[];
  projetIndemnites?: ProjetIndemnite[];
  baremeMajorations?: BaremeMajoration[];
  envois?: EnvoiJournee[];
}) {
  const [tab, setTab] = useState<Tab>("bookings");
  // Destinataires d'envois sans accusé ni réponse (pastille de l'onglet).
  const sansNouvelles = envois.reduce(
    (n, e) =>
      n +
      e.destinataires.filter(
        (d) =>
          d.envoye_le &&
          !d.accuse_le &&
          !(messagesByFigurant[d.figurant_id] ?? []).some((m) => m.sender === "figurant" && m.created_at > d.envoye_le!)
      ).length,
    0
  );
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
                : "border-transparent text-text hover:text-text"
            )}
          >
            {t.label}
            {t.value === "messages" && sansNouvelles > 0 && (
              <span className="ml-1.5 rounded-full bg-yellow/15 px-1.5 py-0.5 text-[11px] text-yellow">⏳ {sansNouvelles}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "bookings" && (
        <div className="flex flex-col gap-4">
          {journeeId && (
            <BesoinsPanel
              besoins={besoins}
              bookings={bookings}
              journeeId={journeeId}
              totalRequis={totalRequis}
              projetId={projetId}
              fonctionsProjet={fonctionsProjet}
            />
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
            fonctionsProjet={fonctionsProjet}
            besoinsFonctions={besoins.map((b) => b.fonction)}
            rows={bookings}
            projetId={projetId}
            date={date}
            templates={templates}
            journeeLieu={journeeLieu}
            convocationSettings={convocationSettings}
            initialReplies={initialReplies}
            messagesByFigurant={messagesByFigurant}
            projetIndemnites={projetIndemnites}
            baremeMajorations={baremeMajorations}
            autresJournees={autresDates}
          />
        </div>
      )}

      {tab === "essayage" && (
        <EssayagesPanel figurants={essayageFigurants} essayages={essayages} projetId={projetId} />
      )}

      {tab === "messages" && (
        <MessagesJournee
          rows={bookings}
          envois={envois}
          projetId={projetId}
          date={date}
          templates={templates}
          journeeLieu={journeeLieu}
          publicOrigin={publicOrigin}
          messagesByFigurant={messagesByFigurant}
        />
      )}

      {tab === "covoiturage" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/bookings/documents/covoiturage${query}`} variant="secondary">
              🚗 Trombi covoiturage
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/covoiturage${query}&vue=liste`} variant="secondary">
              📋 Liste covoiturage
            </ButtonLink>
          </div>
          <CovoiturageBoard
            rows={covoiturageRows}
            date={date}
            projetId={projetId}
            tarifBase={covoiturageTarifBase}
            tarifPassager={covoiturageTarifPassager}
            autresDates={autresDates}
          />
        </div>
      )}

      {tab === "documents" && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-text-muted">Documents & export</h2>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/bookings/documents/liste-appel${query}`} variant="secondary">
              📞 Liste d&apos;appel
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/trombis${query}`} variant="secondary">
              🖼️ Trombis
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/trombis-hmc${query}`} variant="secondary">
              💄 Trombi HMC
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/fiches${query}`} variant="secondary">
              📏 Fiches mensuration
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/bordereau${query}`} variant="secondary">
              ✍️ Bordereau d&apos;émargement
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/covoiturage${query}`} variant="secondary">
              🚗 Trombi covoiturage
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/covoiturage${query}&vue=liste`} variant="secondary">
              📋 Liste covoiturage
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/silhouettes${query}`} variant="secondary">
              🕴️ Tableau silhouette
            </ButtonLink>
            <ButtonLink href={`/bookings/documents/vcards${query}`} variant="secondary">
              📇 Vcards
            </ButtonLink>
            {canExport && (
              <ButtonLink href={`/bookings/export${query}`} variant="secondary">
                📊 Exporter Excel
              </ButtonLink>
            )}
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
