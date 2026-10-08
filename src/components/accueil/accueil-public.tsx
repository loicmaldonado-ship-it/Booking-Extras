import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { AnnoncesOuvertes } from "@/components/candidats/annonces-ouvertes";
import { getCurrentFigurant } from "@/lib/candidats/session";

const ETAPES = [
  {
    titre: "Crée ton profil, une fois",
    texte: "Tes coordonnées, tes mensurations et quelques photos. Tu pourras les modifier quand tu veux.",
  },
  {
    titre: "Postule aux annonces",
    texte: "Tes infos sont déjà remplies : il ne reste qu'à indiquer tes disponibilités et tes photos pour l'annonce.",
  },
  {
    titre: "On te recontacte",
    texte: "Si ton profil correspond, l'équipe casting te propose des dates. Tu suis tout depuis ton espace.",
  },
];

// Accueil public (« / » sans compte équipe) : présenter le site, créer son
// compte candidat·e ou se connecter, voir les annonces ouvertes.
export async function AccueilPublic() {
  const candidat = await getCurrentFigurant();

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Logo iconSize={28} textClassName="text-lg" />
        <Link href="/login" className="text-sm text-text-muted hover:text-text">
          Espace équipe casting →
        </Link>
      </header>

      <section className="flex flex-col gap-5">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight [text-wrap:balance] sm:text-5xl">
          Fais de la figuration sur des tournages près de chez toi.
        </h1>
        <p className="max-w-xl text-lg text-text-muted">
          Crée ton profil une seule fois, puis postule aux annonces des équipes casting en quelques clics.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {candidat ? (
            <Link
              href="/compte"
              className="rounded-full bg-coral px-6 py-3 font-semibold text-ink transition-colors hover:bg-coral-hover"
            >
              Mon espace →
            </Link>
          ) : (
            <>
              <Link
                href="/compte/inscription"
                className="rounded-full bg-coral px-6 py-3 font-semibold text-ink transition-colors hover:bg-coral-hover"
              >
                Créer mon compte
              </Link>
              <Link
                href="/compte/connexion"
                className="rounded-full border border-border px-6 py-3 font-medium text-text transition-colors hover:border-coral/60"
              >
                Me connecter
              </Link>
            </>
          )}
        </div>
        <p className="text-sm font-medium text-turquoise">
          Booking Extras est gratuit et le sera toujours : aucune somme d&apos;argent ne te sera jamais demandée.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ETAPES.map((e, i) => (
          <Card key={e.titre} className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-coral tabular-nums">{i + 1}</span>
            <h2 className="font-semibold">{e.titre}</h2>
            <p className="text-sm text-text-muted">{e.texte}</p>
          </Card>
        ))}
      </section>

      <section className="max-w-2xl">
        <AnnoncesOuvertes />
      </section>

      <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-xs text-text-muted">
        <Link href="/confidentialite" className="hover:text-text">
          Confidentialité
        </Link>
        <Link href="/login" className="hover:text-text">
          Espace équipe casting
        </Link>
      </footer>
    </div>
  );
}
