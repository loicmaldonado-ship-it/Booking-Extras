import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { ListeArtistiqueSheet, type ListeArtistiqueItem } from "@/components/casting/liste-artistique-sheet";
import { getCastingRoles, getCastingEntries } from "@/lib/casting/data";
import { bestEntryForRole } from "@/lib/casting/types";
import { resolvePartageToken, getCastingDocsVisibilityByToken } from "@/lib/partage/data";
import { projetNomPublic } from "@/lib/projets/types";

export const dynamic = "force-dynamic";

const ROLES_PAR_PAGE = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length > 0 ? pages : [[]];
}

export default async function PartageListeArtistiquePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [projet, visibility] = await Promise.all([
    resolvePartageToken(token, "casting"),
    getCastingDocsVisibilityByToken(token),
  ]);

  if (!projet || !visibility.listeArtistique) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Document indisponible</h1>
        <p className="text-text-muted">Ce document n&apos;est pas (ou plus) partagé sur ce lien.</p>
      </div>
    );
  }

  const [roles, entries] = await Promise.all([getCastingRoles(projet.id), getCastingEntries(projet.id)]);
  const entriesByRole = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = entriesByRole.get(e.role_id) ?? [];
    list.push(e);
    entriesByRole.set(e.role_id, list);
  }

  const items: ListeArtistiqueItem[] = roles.map((role, i) => ({
    numero: i + 1,
    role,
    entry: bestEntryForRole(entriesByRole.get(role.id) ?? []),
  }));
  const pages = chunk(items, ROLES_PAR_PAGE);
  const nom = projetNomPublic(projet);

  return (
    <div className="flex flex-col gap-6">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Liste artistique — {nom}</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`liste-artistique-${nom}.pdf`} />
          <PrintButton />
        </div>
      </div>

      {pages.map((page, pageIndex) => (
        <PrintSheet
          key={pageIndex}
          className="break-after-page print:break-after-page"
          pageLabel={pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : undefined}
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Liste artistique — {nom}</h2>
            <ListeArtistiqueSheet items={page} />
          </div>
        </PrintSheet>
      ))}
    </div>
  );
}
