import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { BackLink } from "@/components/ui/back-link";
import { DistributionSheet } from "@/components/casting/distribution-sheet";
import { getListeArtistiqueItems } from "@/lib/casting/liste-artistique";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { getCurrentProjetId } from "@/lib/projet-context";
import { requireProjetAccess } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLES_PAR_PAGE = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length > 0 ? pages : [[]];
}

export default async function DistributionPage() {
  const projetId = await getCurrentProjetId();
  await requireProjetAccess(projetId);
  if (!projetId) {
    return <p className="text-text-muted">Choisis un projet depuis Casting.</p>;
  }

  const supabase = createAdminClient();
  const [{ data: projet }, items] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projetId).single(),
    getListeArtistiqueItems(projetId),
  ]);

  const portraitByFigurant = await getPhotosByFigurantId(items.map((i) => i.entry.figurant_id));
  const portraitUrlByFigurant = new Map(
    items.map((i) => [i.entry.figurant_id, pickPortrait(portraitByFigurant.get(i.entry.figurant_id), projetId)?.url ?? null])
  );
  const pages = chunk(items, ROLES_PAR_PAGE);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/casting" label="Casting" />

      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Distribution — {projet?.nom}</h1>
          <p className="mt-1 text-text-muted">{items.length} rôle{items.length > 1 ? "s" : ""} validé{items.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`distribution-${projet?.nom ?? "projet"}.pdf`} />
          <PrintButton />
        </div>
      </div>

      {items.length === 0 && (
        <PrintSheet>
          <p className="py-6 text-center text-gray-500">Aucun rôle validé pour l&apos;instant.</p>
        </PrintSheet>
      )}

      {pages.map((page, pageIndex) => (
        <PrintSheet
          key={pageIndex}
          className="break-after-page print:break-after-page"
          pageLabel={pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : undefined}
        >
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Distribution — {projet?.nom}</h2>
            <DistributionSheet items={page} portraitByFigurant={portraitUrlByFigurant} />
          </div>
        </PrintSheet>
      ))}
    </div>
  );
}
