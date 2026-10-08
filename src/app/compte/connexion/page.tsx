import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { ConnexionForm } from "@/components/auth/connexion-form";
import { AnnoncesOuvertes } from "@/components/candidats/annonces-ouvertes";
import { CONTACT_SUPPORT_EMAIL } from "@/lib/legal/contact";
import { retourAutorise } from "@/lib/candidats/retour";

export const dynamic = "force-dynamic";

export default async function ConnexionCandidatPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  const retour = retourAutorise((await searchParams).retour);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <div>
        <Link href="/" aria-label="Accueil">
          <Logo iconSize={26} textClassName="text-lg" />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Espace candidat·es</h1>
        <p className="mt-1 text-text-muted">
          Connecte-toi avec ton email et ton mot de passe, ou reçois un lien de connexion par email (pratique si tu
          as postulé avant d&apos;avoir un mot de passe).
        </p>
      </div>

      {retour && (
        <div className="rounded-xl border border-turquoise/40 bg-turquoise/10 px-4 py-3 text-sm">
          Connecte-toi : tu reviendras directement sur l&apos;annonce, avec tes infos déjà remplies.
        </div>
      )}

      <ConnexionForm retour={retour} />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Pas encore de compte ?</p>
          <p className="text-sm text-text-muted">C&apos;est gratuit, et tes infos seront remplies pour chaque candidature.</p>
        </div>
        <Link
          href="/compte/inscription"
          className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-coral-hover"
        >
          Créer mon compte
        </Link>
      </Card>

      <AnnoncesOuvertes />

      <p className="text-center text-xs text-text-muted">
        Un souci pour te connecter ou une question ?{" "}
        <a href={`mailto:${CONTACT_SUPPORT_EMAIL}`} className="text-coral hover:underline">
          {CONTACT_SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
