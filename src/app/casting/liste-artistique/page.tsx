import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { BackLink } from "@/components/ui/back-link";
import { ListeArtistiqueSheet, type ListeArtistiqueItem } from "@/components/casting/liste-artistique-sheet";
import { getCastingRoles, getCastingEntries } from "@/lib/casting/data";
import { bestEntryForRole } from "@/lib/casting/types";
import { getCurrentProjetId } from "@/lib/projet-context";
import { requireProjetAccess } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLES_PAR_PAGE = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages.length > 0 ? pages : [[]];
}

export default async function ListeArtistiquePage() {
  const projetId = await getCurrentProjetId();
  await requireProjetAccess(projetId);
  if (!projetId) {
    return <p className="text-text-muted">Choisis un projet depuis Casting.</p>;
  }

  const supabase = createAdminClient();
  const [{ data: projet }, roles, entries] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projetId).single(),
    getCastingRoles(projetId),
    getCastingEntries(projetId),
  ]);

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

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/casting" label="Casting" />

      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Liste artistique — {projet?.nom}</h1>
          <p className="mt-1 text-text-muted">{roles.length} rôle{roles.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`liste-artistique-${projet?.nom ?? "projet"}.pdf`} />
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
            <h2 className="text-lg font-semibold text-gray-900">Liste artistique — {projet?.nom}</h2>
            <ListeArtistiqueSheet items={page} />
          </div>
        </PrintSheet>
      ))}
    </div>
  );
}
