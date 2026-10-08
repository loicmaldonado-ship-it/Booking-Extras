import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { PostulerForm } from "@/components/candidatures/postuler-form";
import { getCurrentFigurant } from "@/lib/candidats/session";
import { CONTACT_SUPPORT_EMAIL } from "@/lib/legal/contact";

export const dynamic = "force-dynamic";

// Création de compte candidat·e sans annonce : profil complet (mêmes champs
// que la candidature) + photos + mot de passe.
export default async function InscriptionPage() {
  if (await getCurrentFigurant()) redirect("/compte");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href="/" aria-label="Accueil">
          <Logo iconSize={26} textClassName="text-lg" />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Créer mon compte</h1>
        <p className="mt-1 text-text-muted">
          Gratuit, et une fois pour toutes : quand tu postuleras à une annonce, tes infos seront déjà remplies. Seules
          les photos te seront redemandées, pour qu&apos;elles correspondent à chaque annonce (tu pourras reprendre
          celles de ton compte).
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Déjà un compte ?{" "}
          <Link href="/compte/connexion" className="font-medium text-coral hover:underline">
            Me connecter
          </Link>
        </p>
      </div>

      <PostulerForm mode="inscription" questions={[]} dates={[]} />

      <p className="text-center text-xs text-text-muted">
        Une question ?{" "}
        <a href={`mailto:${CONTACT_SUPPORT_EMAIL}`} className="text-coral hover:underline">
          {CONTACT_SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
