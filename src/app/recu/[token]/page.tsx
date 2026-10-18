import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { projetNomPublic } from "@/lib/projets/types";
import { formatPrenom } from "@/lib/noms";
import { BienRecuBouton } from "@/components/messages/bien-recu-bouton";

export const dynamic = "force-dynamic";

// Lien « 👍 Bien reçu » ajouté aux messages d'info (onglet Messages d'une
// journée) : la personne confirme la réception en un clic, sans compte.
// Un bouton plutôt qu'une confirmation à l'ouverture : les antivirus de
// messagerie ouvrent les liens tout seuls, ça fausserait le suivi.
export default async function BienRecuPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: ligne } = /^[0-9a-f-]{36}$/i.test(token)
    ? await createAdminClient()
        .from("envoi_destinataires")
        .select("accuse_le, figurants(prenom), envois(titre, projets(nom, confidentiel, nom_code))")
        .eq("token", token)
        .maybeSingle<{
          accuse_le: string | null;
          figurants: { prenom: string } | null;
          envois: { titre: string; projets: { nom: string; confidentiel: boolean; nom_code: string | null } | null } | null;
        }>()
    : { data: null };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/" aria-label="Accueil">
        <Logo iconSize={26} textClassName="text-lg" />
      </Link>
      <Card className="flex flex-col gap-4">
        {!ligne ? (
          <>
            <h1 className="text-lg font-semibold">Lien invalide</h1>
            <p className="text-sm text-text-muted">Ce lien n&apos;existe pas ou n&apos;est plus valable.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">
              Bonjour {formatPrenom(ligne.figurants?.prenom)} 👋
            </h1>
            <p className="text-sm text-text-muted">
              Message « {ligne.envois?.titre} » — {projetNomPublic(ligne.envois?.projets, "notre tournage")}
            </p>
            <BienRecuBouton token={token} dejaConfirme={!!ligne.accuse_le} />
          </>
        )}
      </Card>
    </div>
  );
}
