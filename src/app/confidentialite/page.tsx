import Link from "next/link";
import { Card } from "@/components/ui/card";
import { RESPONSABLE_TRAITEMENT, CONTACT_RGPD_EMAIL } from "@/lib/legal/contact";

export const metadata = {
  title: "Confidentialité — Booking Extras",
};

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-10">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Politique de confidentialité</h1>
        <p className="mt-1 text-text-muted">
          Comment vos informations sont utilisées quand vous postulez ou que vous avez un espace personnel sur
          Booking Extras.
        </p>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted">Qui gère vos données ?</h2>
        <p className="text-sm">{RESPONSABLE_TRAITEMENT}, contact : {CONTACT_RGPD_EMAIL}.</p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted">Pourquoi collecte-t-on ces informations ?</h2>
        <p className="text-sm">
          Pour étudier votre candidature à une figuration ou un rôle et, si votre profil est retenu, organiser votre
          venue sur le tournage (convocation, contrat, paie).
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted">Quelles informations ?</h2>
        <p className="text-sm">
          Identité, contact, mensurations, photos, disponibilités, et les documents liés à votre venue sur un
          tournage si vous êtes retenu·e.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted">Bon à savoir</h2>
        <p className="text-sm">
          Booking Extras ne gère pas les données liées à la paie — aucun document servant à la paie (RIB, pièce
          d&apos;identité pour la paie...) ne vous sera jamais demandé ici.
        </p>
        <p className="text-sm">
          L&apos;inscription et la candidature sur Booking Extras sont entièrement gratuites. Aucune somme
          d&apos;argent ne vous sera jamais demandée.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted">Combien de temps sont-elles conservées ?</h2>
        <p className="text-sm">
          2 ans maximum après notre dernier contact si vous n&apos;êtes pas retenu·e. Sans limite tant que vous
          restez actif·ve sur le site (candidatures, tournages), avec suppression sur simple demande.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted">Qui y a accès ?</h2>
        <p className="text-sm">
          L&apos;équipe de casting Booking Extras uniquement. Vos données sont hébergées en Europe (Supabase, Paris)
          et le site est opéré via Vercel — aucun des deux n&apos;a le droit de les utiliser pour son propre compte.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-muted">Vos droits</h2>
        <p className="text-sm">
          Vous pouvez à tout moment demander l&apos;accès, la correction ou la suppression de vos données en
          écrivant à{" "}
          <a href={`mailto:${CONTACT_RGPD_EMAIL}`} className="text-coral hover:underline">
            {CONTACT_RGPD_EMAIL}
          </a>
          , ou en vous connectant à votre espace personnel. Vous pouvez aussi saisir la{" "}
          <a href="https://www.cnil.fr" target="_blank" rel="noreferrer" className="text-coral hover:underline">
            CNIL
          </a>{" "}
          si vous estimez que vos droits ne sont pas respectés.
        </p>
      </Card>

      <Link href="/" className="text-sm text-text-muted hover:text-coral">
        ← Retour à l&apos;accueil
      </Link>
    </div>
  );
}
