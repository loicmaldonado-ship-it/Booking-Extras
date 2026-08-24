import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { setCurrentProjet } from "@/lib/projet-context";
import { Card, Badge } from "@/components/ui/card";
import { InviteChefForm } from "@/components/admin/invite-chef-form";
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
  const [{ data: chefs }, { data: projets }] = await Promise.all([
    supabase.from("profiles").select("id, email, nom").eq("role", "chef").order("email"),
    supabase.from("projets").select("id, nom, owner_id").eq("archive", false),
  ]);

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
          return (
            <div key={c.id} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{c.nom || c.email}</div>
                  <div className="text-xs text-text-muted">{c.email}</div>
                </div>
                <Badge>
                  {leursProjets.length} projet{leursProjets.length > 1 ? "s" : ""}
                </Badge>
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
