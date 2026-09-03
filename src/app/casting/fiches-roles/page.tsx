import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { BackLink } from "@/components/ui/back-link";
import { FicheRoleValideSheet } from "@/components/casting/fiche-role-valide-sheet";
import { getCastingRoles, getCastingEntries } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { getCurrentProjetId } from "@/lib/projet-context";
import { requireProjetAccess } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function FichesRolesPage() {
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

  // Seuls les rôles avec un comédien validé — c'est le sens du document,
  // pas juste "le meilleur candidat" comme pour la liste artistique.
  const fiches = roles
    .map((role) => ({ role, entry: (entriesByRole.get(role.id) ?? []).find((e) => e.statut === "valide") ?? null }))
    .filter((f): f is { role: (typeof roles)[number]; entry: NonNullable<typeof f.entry> } => !!f.entry);

  const portraitByFigurant = await getPhotosByFigurantId(fiches.map((f) => f.entry.figurant_id));

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/casting" label="Casting" />

      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Fiches rôles validés — {projet?.nom}</h1>
          <p className="mt-1 text-text-muted">{fiches.length} rôle{fiches.length > 1 ? "s" : ""} validé{fiches.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`fiches-roles-valides-${projet?.nom ?? "projet"}.pdf`} />
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
            portraitUrl={pickPortrait(portraitByFigurant.get(entry.figurant_id), projetId)?.url ?? null}
          />
        </PrintSheet>
      ))}
    </div>
  );
}
