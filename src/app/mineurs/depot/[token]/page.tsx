import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { bearerDossier } from "@/lib/minors/dossiers";
import { createAdminClient } from "@/lib/supabase/admin";
import { MinorUploadForm } from "@/components/minors/dossier-forms";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dépôt de pièces — Booking Extras", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function MinorUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await bearerDossier(token, "upload"); if (!access) notFound();
  const { data: requirements, error } = await createAdminClient().from("minor_requirements").select("id,label,required,active").eq("projet_id", access.dossier.projet_id).eq("active", true).order("created_at");
  if (error) throw new Error("Liste des pièces momentanément indisponible.");
  return <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10"><h1 className="text-2xl font-semibold">Dossier de {access.child.prenom} {access.child.nom}</h1><p>Déposez ici votre autorisation parentale signée et les pièces demandées par l’équipe. Ce lien est privé, limité à ce dossier et valable jusqu’au {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(access.link.expires_at))}.</p><Card><MinorUploadForm token={token} kind={access.link.kind} requirements={access.age !== null && access.age < 16 ? requirements ?? [] : []} /></Card><p className="text-sm text-text-muted">Le dépôt ne vaut pas validation. L’équipe vérifie les pièces avant le booking. Pour toute question ou pour obtenir un modèle d’autorisation, contactez votre équipe casting. Ne partagez pas ce lien.</p></div>;
}
