import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { InviteAssistantForm } from "@/components/equipe/invite-assistant-form";
import { MembresList, type Membre } from "@/components/equipe/membres-list";

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

  const [{ data: projets }, { data: membresRaw }] = await Promise.all([
    projetsQuery,
    membresQuery.returns<Membre[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Équipe</h1>
        <p className="mt-1 text-text-muted">
          Invite des assistant·es sur des projets précis. Une invitation par projet — révocable à tout moment.
        </p>
      </div>

      <Card>
        <InviteAssistantForm projets={projets ?? []} />
      </Card>

      <MembresList membres={membresRaw ?? []} />
    </div>
  );
}
