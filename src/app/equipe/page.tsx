import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { getMyTeamPresence } from "@/lib/auth/team-presence";
import { Card } from "@/components/ui/card";
import { InviteAssistantForm } from "@/components/equipe/invite-assistant-form";
import { MembresList, type Membre } from "@/components/equipe/membres-list";
import { TeamPresenceList } from "@/components/equipe/team-presence-list";
import { MyEmailPanel } from "@/components/equipe/my-email-panel";
import { MyEmailTemplatesPanel } from "@/components/equipe/my-email-templates-panel";

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
    .select("id, created_at, projets(id, nom), profiles(id, email, nom, sections_autorisees)")
    .order("created_at", { ascending: false });
  if (accessibleIds !== null) membresQuery = membresQuery.in("projet_id", idsOrNone(accessibleIds));

  const [{ data: projets }, { data: membresRaw }, teamPresence, { data: myProfile }] = await Promise.all([
    projetsQuery,
    membresQuery.returns<Membre[]>(),
    getMyTeamPresence(profile),
    supabase
      .from("profiles")
      .select("gmail_smtp_user, email_espace_perso_template, email_magic_link_template")
      .eq("id", profile.id)
      .maybeSingle(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Équipe</h1>
        <p className="mt-1 text-text-muted">
          Invite des assistant·es sur des projets précis. Une invitation par projet — révocable à tout moment.
        </p>
      </div>

      <TeamPresenceList title="Qui est connecté·e" members={teamPresence} />

      <MyEmailPanel gmailUser={myProfile?.gmail_smtp_user ?? null} />

      <MyEmailTemplatesPanel
        espacePerso={myProfile?.email_espace_perso_template ?? null}
        magicLink={myProfile?.email_magic_link_template ?? null}
      />

      <Card>
        <InviteAssistantForm projets={projets ?? []} />
      </Card>

      <MembresList membres={membresRaw ?? []} />
    </div>
  );
}
