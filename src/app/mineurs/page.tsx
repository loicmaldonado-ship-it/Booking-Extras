import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getAccessibleProjetIds, getCurrentProfile, idsOrNone, requireProjetAccess } from "@/lib/auth/session";
import { hasSectionAccess } from "@/lib/auth/sections";

// Entrée du menu « Mineurs / DRIEETS » : les dossiers mineurs sont rangés par projet. Avec un projet actif, on l'ouvre ;
// sans projet actif, on propose la liste des projets accessibles (avant le 02/11/2026, on renvoyait sans explication
// vers /projets, ce qui donnait l'impression que la page n'existait pas).
export default async function MineursPage() {
  const profile = await getCurrentProfile();
  if (!hasSectionAccess(profile, "/mineurs")) notFound();
  const project = await getCurrentProjetId();
  if (project) {
    await requireProjetAccess(project);
    redirect(`/projets/${project}/mineurs`);
  }
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;
  let query = createAdminClient().from("projets").select("id, nom, archive").order("nom");
  if (accessibleIds !== null) query = query.in("id", idsOrNone(accessibleIds));
  const { data: projets, error } = await query;
  if (error) throw new Error("Liste des projets temporairement indisponible.");
  const enCours = (projets ?? []).filter((p) => !p.archive);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Mineurs / DRIEETS</h1>
        <p className="mt-2 text-sm text-text-muted">
          Les dossiers mineurs (représentants légaux, pièces, préparation DRIEETS) sont rangés par projet. Choisis le projet.
        </p>
      </div>
      <Card className="flex flex-col gap-2">
        {enCours.length === 0 ? (
          <p className="text-sm text-text-muted">
            Aucun projet en cours. <Link className="text-coral underline" href="/projets">Crée ou ouvre un projet</Link> pour préparer un dossier mineur.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {enCours.map((p) => (
              <li key={p.id}>
                <Link className="block py-3 text-coral hover:underline" href={`/projets/${p.id}/mineurs`}>
                  {p.nom}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
