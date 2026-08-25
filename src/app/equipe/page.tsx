import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { getMyTeamPresence } from "@/lib/auth/team-presence";
import { Card } from "@/components/ui/card";
import { InviteAssistantForm } from "@/components/equipe/invite-assistant-form";
import { MembresList, type Membre } from "@/components/equipe/membres-list";
import { TeamPresenceList } from "@/components/equipe/team-presence-list";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "chef") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Équipe</h1>
        <Card>
          <p className="text-sm text-text-muted">Cette page est réservée au·à la chef·fe de casting.</p>
        </Card>
      </div>
    );
  }

  const supabase = createAdminClient();
  const accessibleIds = await getAccessibleProjetIds(profile);

  let projetsQuery = supabase.from("projets").select("id, nom").order("nom");
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));

  let membresQuery = supabase
    .from("projet_membres")
    .select("id, created_at, projets(id, nom), profiles(id, email, nom)")
    .order("created_at", { ascending: false });
  if (accessibleIds !== null) membresQuery = membresQuery.in("projet_id", idsOrNone(accessibleIds));

  const [{ data: projets }, { data: membresRaw }, teamPresence] = await Promise.all([
    projetsQuery,
    membresQuery.returns<Membre[]>(),
    getMyTeamPresence(profile),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Équipe</h1>
        <p className="mt-1 text-text-muted">
          Invite des assistant·es sur des projets précis. Une invitation par projet — révocable à tout moment.
        </p>
      </div>

      <TeamPresenceList title="Qui est connecté" members={teamPresence} />

      <Card>
        <InviteAssistantForm projets={projets ?? []} />
      </Card>

      <MembresList membres={membresRaw ?? []} />
    </div>
  );
}
