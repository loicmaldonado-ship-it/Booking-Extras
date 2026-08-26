import Link from "next/link";
import { getCurrentProfile, profileDisplayName } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { setCurrentProjet } from "@/lib/projet-context";
import { isOnline } from "@/lib/auth/presence";
import { Card, Badge } from "@/components/ui/card";
import { InviteChefForm } from "@/components/admin/invite-chef-form";
import { RevokeChefButton } from "@/components/admin/revoke-chef-button";
import { TeamPresenceList, type PresenceMember } from "@/components/equipe/team-presence-list";
import { formatDateTime } from "@/lib/format-date";
import { Crown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await getCurrentProfile();

  if (!isOwner(profile)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <Card>
          <p className="text-sm text-text-muted">Cette page est réservée au compte propriétaire.</p>
        </Card>
      </div>
    );
  }

  const supabase = createAdminClient();
  const [{ data: chefs }, { data: projets }, { data: tousLesProfils }, { data: usersList }] = await Promise.all([
    supabase.from("profiles").select("id, email, nom, prenom").eq("role", "chef").order("email"),
    supabase.from("projets").select("id, nom, owner_id").eq("archive", false),
    supabase
      .from("profiles")
      .select("id, email, nom, prenom, role, avatar_storage_path, last_seen_at")
      .order("role")
      .returns<
        { id: string; email: string | null; nom: string | null; prenom: string | null; role: "chef" | "assistant"; avatar_storage_path: string | null; last_seen_at: string | null }[]
      >(),
    supabase.auth.admin.listUsers(),
  ]);

  const revokedById = new Map(
    (usersList?.users ?? []).map((u) => [u.id, !!u.banned_until && new Date(u.banned_until) > new Date()])
  );

  const presenceMembers: PresenceMember[] = (tousLesProfils ?? []).map((p) => ({
    id: p.id,
    nom: profileDisplayName(p),
    email: p.email,
    role: p.role,
    avatarUrl: p.avatar_storage_path
      ? supabase.storage.from("profile-avatars").getPublicUrl(p.avatar_storage_path).data.publicUrl
      : null,
    online: p.email === profile!.email ? true : isOnline(p.last_seen_at),
  }));

  const projetsByOwner = new Map<string, { id: string; nom: string }[]>();
  for (const p of projets ?? []) {
    if (!p.owner_id) continue;
    const list = projetsByOwner.get(p.owner_id) ?? [];
    list.push({ id: p.id, nom: p.nom });
    projetsByOwner.set(p.owner_id, list);
  }

  const autresChefs = (chefs ?? []).filter((c) => c.email !== profile!.email);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Crown size={28} strokeWidth={1.75} />
          Admin
        </h1>
        <p className="mt-1 text-text-muted">
          Ton compte a accès à tous les projets, y compris ceux des autres chef·fes — pratique pour aller
          aider si besoin.
        </p>
      </div>

      <TeamPresenceList title="Qui est connecté·e (toute l'agence)" members={presenceMembers} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Dernière connexion</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="py-2 pr-4 font-medium">Nom</th>
                <th className="py-2 pr-4 font-medium">Rôle</th>
                <th className="py-2 pr-4 font-medium">Dernière connexion</th>
              </tr>
            </thead>
            <tbody>
              {(tousLesProfils ?? [])
                .slice()
                .sort((a, b) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? ""))
                .map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium">{profileDisplayName(p)}</td>
                    <td className="py-2 pr-4 text-text-muted">{p.role === "chef" ? "Chef·fe" : "Assistant·e"}</td>
                    <td className="py-2 pr-4 text-text-muted">
                      {p.last_seen_at ? formatDateTime(p.last_seen_at) : "Jamais connecté·e"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Inviter un·e chef·fe</h2>
        <p className="text-sm text-text-muted">
          Un compte chef·fe indépendant : base Figurants commune, mais projets et bookings privés (invisibles
          des autres chef·fes, sauf partage explicite).
        </p>
        <InviteChefForm />
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Chef·fes de casting</h2>
        {autresChefs.length === 0 && (
          <p className="text-sm text-text-muted">Aucune autre chef·fe pour l&apos;instant.</p>
        )}
        {autresChefs.map((c) => {
          const leursProjets = projetsByOwner.get(c.id) ?? [];
          const revoked = revokedById.get(c.id) ?? false;
          return (
            <div key={c.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{profileDisplayName(c)}</div>
                  <div className="text-xs text-text-muted">{c.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {revoked && <Badge tone="danger">Accès révoqué</Badge>}
                  <Badge>
                    {leursProjets.length} projet{leursProjets.length > 1 ? "s" : ""}
                  </Badge>
                  <RevokeChefButton chefId={c.id} revoked={revoked} />
                </div>
              </div>
              {leursProjets.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {leursProjets.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 rounded-full border border-border pl-3 pr-1 py-1">
                      <Link href={`/projets/${p.id}`} className="text-xs font-medium hover:text-coral">
                        {p.nom}
                      </Link>
                      <form action={setCurrentProjet.bind(null, p.id, "/bookings")}>
                        <button
                          type="submit"
                          className="rounded-full bg-ink-raised-2 px-2 py-0.5 text-[10px] font-medium text-text-muted hover:text-coral"
                          title="Ouvrir Bookings/Casting/Essayages pour ce projet"
                        >
                          Piloter →
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
