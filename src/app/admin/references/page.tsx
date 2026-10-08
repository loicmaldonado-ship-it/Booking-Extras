import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/ui/back-link";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { getReferences } from "@/lib/references/data";
import { ReferencesPanel } from "@/components/admin/references-panel";

export const dynamic = "force-dynamic";

// Films et séries affichés dans le bandeau de l'accueil public.
export default async function AdminReferencesPage() {
  const profile = await getCurrentProfile();
  if (!isOwner(profile)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Références</h1>
        <Card>
          <p className="text-sm text-text-muted">Cette page est réservée au compte propriétaire.</p>
        </Card>
      </div>
    );
  }

  const references = await getReferences();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <BackLink href="/admin" label="Admin" />
      <div>
        <h1 className="text-3xl font-semibold">Références</h1>
        <p className="mt-1 text-text-muted">
          Les films et séries sur lesquels vous avez travaillé, affichés en bandeau sur la page d&apos;accueil du
          site, dans cet ordre. N&apos;ajoute une affiche que si la production ou le distributeur est d&apos;accord.
        </p>
      </div>
      <ReferencesPanel references={references} />
    </div>
  );
}
