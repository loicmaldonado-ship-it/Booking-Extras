import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { CreerCompteForm } from "@/components/candidats/creer-compte-form";
import { invitationValide } from "@/lib/candidats/invitation-lecture";
import { MOT_DE_PASSE_MIN } from "@/lib/candidats/profil";
import { retourAutorise } from "@/lib/candidats/retour";
import { formatPrenom } from "@/lib/noms";
import { CONTACT_SUPPORT_EMAIL } from "@/lib/legal/contact";

export const dynamic = "force-dynamic";

// Lien « Crée ton compte » reçu par email (profil ajouté par l'équipe, ou
// fiche retrouvée en postulant) : choix du mot de passe, puis espace perso.
export default async function CreerComptePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; retour?: string }>;
}) {
  const { token, retour: retourBrut } = await searchParams;
  const retour = retourAutorise(retourBrut);
  const invitation = token ? await invitationValide(token) : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
      <Link href="/" aria-label="Accueil">
        <Logo iconSize={26} textClassName="text-lg" />
      </Link>

      {!invitation ? (
        <Card className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold">Lien expiré ou déjà utilisé</h1>
          <p className="text-sm text-text-muted">
            Si tu as déjà créé ton compte, connecte-toi. Sinon, entre ton email sur la page de connexion : on t&apos;enverra
            un nouveau lien.
          </p>
          <Link href="/compte/connexion" className="text-sm font-medium text-coral hover:underline">
            Aller à la connexion →
          </Link>
        </Card>
      ) : invitation.compteExistant ? (
        <Card className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold">Ton compte existe déjà</h1>
          <p className="text-sm text-text-muted">Connecte-toi avec ton email et ton mot de passe.</p>
          <Link
            href={retour ? `/compte/connexion?retour=${encodeURIComponent(retour)}` : "/compte/connexion"}
            className="text-sm font-medium text-coral hover:underline"
          >
            Me connecter →
          </Link>
        </Card>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold">Bonjour {formatPrenom(invitation.prenom)}, crée ton compte</h1>
            <p className="mt-1 text-text-muted">
              Ta fiche est déjà dans notre base. Choisis un mot de passe : tu pourras suivre tes dates de tournage,
              compléter ta fiche et postuler à nos annonces.
            </p>
          </div>
          <CreerCompteForm token={token!} email={invitation.email} retour={retour} min={MOT_DE_PASSE_MIN} />
        </>
      )}

      <p className="text-center text-xs text-text-muted">
        Une question ?{" "}
        <a href={`mailto:${CONTACT_SUPPORT_EMAIL}`} className="text-coral hover:underline">
          {CONTACT_SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
