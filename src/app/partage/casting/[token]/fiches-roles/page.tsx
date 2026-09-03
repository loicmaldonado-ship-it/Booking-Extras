import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FicheRoleValideSheet } from "@/components/casting/fiche-role-valide-sheet";
import { getCastingRoles, getCastingEntries } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { resolvePartageToken, getCastingDocsVisibilityByToken } from "@/lib/partage/data";
import { projetNomPublic } from "@/lib/projets/types";

export const dynamic = "force-dynamic";

export default async function PartageFichesRolesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [projet, visibility] = await Promise.all([
    resolvePartageToken(token, "casting"),
    getCastingDocsVisibilityByToken(token),
  ]);

  if (!projet || !visibility.fichesRoles) {
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

  const fiches = roles
    .map((role) => ({ role, entry: (entriesByRole.get(role.id) ?? []).find((e) => e.statut === "valide") ?? null }))
    .filter((f): f is { role: (typeof roles)[number]; entry: NonNullable<typeof f.entry> } => !!f.entry);

  const portraitByFigurant = await getPhotosByFigurantId(fiches.map((f) => f.entry.figurant_id));
  const nom = projetNomPublic(projet);

  return (
    <div className="flex flex-col gap-6">
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fiches rôles validés — {nom}</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`fiches-roles-valides-${nom}.pdf`} />
          <PrintButton />
        </div>
      </div>

      {fiches.length === 0 && (
        <PrintSheet>
          <p className="py-6 text-center text-gray-500">Aucun rôle validé pour l&apos;instant.</p>
        </PrintSheet>
      )}

      {fiches.map(({ role, entry }, i) => (
        <PrintSheet
          key={role.id}
          fixedHeight
          className="break-after-page print:break-after-page"
          pageLabel={fiches.length > 1 ? `${i + 1} / ${fiches.length}` : undefined}
        >
          <FicheRoleValideSheet
            role={role}
            entry={entry}
            portraitUrl={pickPortrait(portraitByFigurant.get(entry.figurant_id), projet.id)?.url ?? null}
          />
        </PrintSheet>
      ))}
    </div>
  );
}
