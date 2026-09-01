import { Card } from "@/components/ui/card";
import { BackLink } from "@/components/ui/back-link";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { listAgents } from "@/lib/agents/actions";
import { AgentsAdminPanel } from "@/components/admin/agents-admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const profile = await getCurrentProfile();

  if (!isOwner(profile)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Agents</h1>
        <Card>
          <p className="text-sm text-text-muted">Cette page est réservée au compte propriétaire.</p>
        </Card>
      </div>
    );
  }

  const agents = await listAgents();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin" label="Admin" />

      <div>
        <h1 className="text-3xl font-semibold">Base Agents</h1>
        <p className="mt-1 text-text-muted">
          Alimentée automatiquement dès qu&apos;un agent est saisi sur une fiche ou une carte casting, pour être
          proposé en autocomplete la fois suivante — gérable ici manuellement si besoin.
        </p>
      </div>

      <AgentsAdminPanel agents={agents} />
    </div>
  );
}
