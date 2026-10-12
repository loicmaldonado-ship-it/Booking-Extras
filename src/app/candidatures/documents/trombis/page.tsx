import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCandidaturesPourDocuments, getPhotosDesCandidatures } from "@/lib/candidatures/documents";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { SortChips } from "@/components/documents/sort-chips";
import { TrombiGrid } from "@/components/documents/trombi-grid";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { parseFields, parseIds } from "@/lib/documents/fields";
import { parseDocSort } from "@/lib/documents/sort";
import { buildTrombiItems, paginateGroupedItems } from "@/lib/documents/trombi";
import { requireProjetAccess } from "@/lib/auth/session";

// Trombi d'une sélection de candidatures (page Candidatures), avant tout
// booking — même mise en page que le trombi d'une journée.
export default async function CandidaturesTrombisPage({
  searchParams,
}: {
  searchParams: Promise<{ annonce_id?: string; ids?: string; fields?: string | string[]; sort?: string | string[] }>;
}) {
  const { annonce_id, ids, fields, sort } = await searchParams;
  if (!annonce_id) return <p className="text-text-muted">Choisis une annonce.</p>;

  const data = await getCandidaturesPourDocuments(annonce_id, parseIds(ids));
  if (!data) return <p className="text-text-muted">Annonce introuvable.</p>;
  await requireProjetAccess(data.annonce.projet_id);

  const projetId = data.annonce.projet_id;
  const selectedFields = parseFields(fields);
  const docSort = parseDocSort(sort);
  const supabase = createAdminClient();
  const [{ data: projet }, documentTemplate, photosByFigurant] = await Promise.all([
    supabase.from("projets").select("nom, realisateur, societe_production").eq("id", projetId).single(),
    getDocumentTemplate(supabase, projetId),
    getPhotosDesCandidatures(data.items),
  ]);
  const pages = paginateGroupedItems(buildTrombiItems(data.items, docSort), (i) => i.headerLabel);
  const letterhead = (
    <DocumentLetterhead
      societe={projet?.societe_production ?? null}
      filmNom={projet?.nom ?? ""}
      dateLabel={`Candidatures · ${data.annonce.titre}`}
      realisateur={projet?.realisateur}
      logoUrl={documentTemplate.logoUrl}
      accentColor={documentTemplate.accentColor}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/candidatures?annonce_id=${annonce_id}`}
        className="print-hide inline-flex items-center gap-1 text-sm text-text-muted hover:text-coral"
      >
        ← Retour aux candidatures
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Trombi · {data.items.length} candidature{data.items.length > 1 ? "s" : ""}
        </h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename="trombi-candidatures.pdf" orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <SortChips baseParams={{ annonce_id, ids, fields }} current={docSort} />
      <FieldsToggle projetId={projetId} date="" selected={selectedFields} extraHidden={{ annonce_id, ids, sort: docSort }} />

      {pages.length === 0 && (
        <PrintSheet orientation="landscape">
          {letterhead}
          <p className="py-6 text-center text-gray-500">Aucune candidature sélectionnée.</p>
        </PrintSheet>
      )}

      {pages.map((page, pageIndex) => (
        <PrintSheet
          key={pageIndex}
          orientation="landscape"
          fixedHeight
          className="break-after-page print:break-after-page"
          pageLabel={pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : undefined}
        >
          {letterhead}
          <TrombiGrid items={page} selectedFields={selectedFields} photosByFigurant={photosByFigurant} projetId={projetId} />
        </PrintSheet>
      ))}
    </div>
  );
}
