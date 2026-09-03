import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { AnchorButton } from "@/components/ui/button";
import { ListeArtistiqueSheet } from "@/components/casting/liste-artistique-sheet";
import { getListeArtistiqueItems } from "@/lib/casting/liste-artistique";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
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

  const items = await getListeArtistiqueItems(projet.id);
  const portraitByFigurant = await getPhotosByFigurantId(items.map((i) => i.entry.figurant_id));
  const portraitUrlByFigurant = new Map(
    items.map((i) => [i.entry.figurant_id, pickPortrait(portraitByFigurant.get(i.entry.figurant_id), projet.id)?.url ?? null])
  );
  const pages = chunk(items, ROLES_PAR_PAGE);
  const nom = projetNomPublic(projet);

  return (
    <div className="flex flex-col gap-6">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Liste artistique — {nom}</h1>
        <div className="flex gap-3">
          <AnchorButton href={`/partage/casting/${token}/liste-artistique/export`} variant="secondary">
            Télécharger Excel
          </AnchorButton>
          <DownloadPdfButton filename={`liste-artistique-${nom}.pdf`} />
          <PrintButton />
        </div>
      </div>

      {items.length === 0 ? (
        <PrintSheet>
          <p className="py-6 text-center text-gray-500">Aucun rôle validé pour l&apos;instant.</p>
        </PrintSheet>
      ) : (
        pages.map((page, pageIndex) => (
          <PrintSheet
            key={pageIndex}
            className="break-after-page print:break-after-page"
            pageLabel={pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : undefined}
          >
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Liste artistique — {nom}</h2>
              <ListeArtistiqueSheet items={page} portraitByFigurant={portraitUrlByFigurant} />
            </div>
          </PrintSheet>
        ))
      )}
    </div>
  );
}
