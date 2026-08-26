import Link from "next/link";
import type { ReactNode } from "react";
import {
  BookOpen as HelpIcon,
  Plus,
  Clapperboard,
  Users,
  Megaphone,
  FileText,
  Video,
  BookOpen,
  Shirt,
  FolderOpen,
  Share2,
  MessageCircle,
  UsersRound,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { Card, Badge } from "@/components/ui/card";

// Guide de prise en main, réécrit dans l'appli (voir aussi la version
// artefact publiée pour Loïc). Chaque chapitre correspond à une section
// réelle du produit — en ajouter un ou une étape ici est la façon
// "automatique" de garder ce guide à jour : à chaque nouvelle fonctionnalité
// livrée, on met à jour le chapitre concerné dans la même session.
const AUDIENCE = {
  tous: { label: "Tout le monde", tone: "default" as const },
  chef: { label: "Chef·fe", tone: "coral" as const },
  assistant: { label: "Assistant·e", tone: "turquoise" as const },
};

function GuideChapter({
  id,
  icon: Icon,
  title,
  audiences,
  intro,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  audiences: (keyof typeof AUDIENCE)[];
  intro: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-raised-2 text-coral">
          <Icon size={19} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {audiences.map((a) => (
              <Badge key={a} tone={AUDIENCE[a].tone}>
                {AUDIENCE[a].label}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-text-muted">{intro}</p>
      {children}
    </Card>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-text-muted">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-raised-2 text-xs font-medium text-text">
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Callout({ tone = "turquoise", children }: { tone?: "turquoise" | "yellow"; children: ReactNode }) {
  const styles =
    tone === "yellow" ? "border-yellow/50 bg-yellow/10 text-yellow" : "border-turquoise/50 bg-turquoise/10 text-turquoise";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <span className="text-text-muted">{children}</span>
    </div>
  );
}

function MiniGrid({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.title} className="rounded-xl border border-border bg-ink px-4 py-3">
          <p className="text-sm font-semibold">{it.title}</p>
          <p className="mt-1 text-sm text-text-muted">{it.body}</p>
        </div>
      ))}
    </div>
  );
}

function UI({ children }: { children: ReactNode }) {
  return <code className="rounded border border-border bg-ink-raised-2 px-1.5 py-0.5 text-[0.85em]">{children}</code>;
}

const NAV = [
  { id: "premiers-pas", label: "Premiers pas" },
  { id: "projets", label: "Projets" },
  { id: "base-profils", label: "Base Profils" },
  { id: "annonces", label: "Annonces" },
  { id: "candidatures", label: "Candidatures" },
  { id: "casting", label: "Casting" },
  { id: "bookings", label: "Bookings" },
  { id: "essayages", label: "Essayages" },
  { id: "documents", label: "Documents" },
  { id: "partage", label: "Partage" },
  { id: "messagerie", label: "Messagerie" },
  { id: "equipe", label: "Équipe & boîte mail" },
  { id: "autres", label: "Modèles, Barème, RGPD" },
];

export default function AidePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <HelpIcon size={28} strokeWidth={1.75} />
          Prise en main
        </h1>
        <p className="mt-2 max-w-2xl text-text-muted">
          Ce guide suit l&apos;ordre dans lequel tu utiliseras vraiment l&apos;outil, du premier
          login jusqu&apos;au trombinoscope envoyé au réal. Chaque section se lit seule — pas
          besoin de tout lire d&apos;un coup.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-coral/60 hover:text-text"
          >
            {n.label}
          </a>
        ))}
      </div>

      <GuideChapter
        id="premiers-pas"
        icon={Plus}
        title="Premiers pas"
        audiences={["tous"]}
        intro="Une fois ton compte créé (invitation reçue par email), voici ce que tu trouves en arrivant et comment naviguer."
      >
        <div>
          <p className="mb-2 text-sm font-semibold">Le bandeau du haut</p>
          <Steps
            items={[
              <>
                <strong className="text-text">Menu de section</strong> (à côté du logo) — bascule entre Base
                Profils, Projets, Bookings, etc.
              </>,
              <>
                <strong className="text-text">Loupe</strong> — recherche rapide un profil, un projet ou une
                annonce par nom (raccourci <UI>⌘K</UI>).
              </>,
              <>
                <strong className="text-text">Cloche</strong> — notifications (candidature reçue, réponse
                d&apos;un figurant, vidéo de casting envoyée).
              </>,
              <>
                <strong className="text-text">Ta photo</strong> — en haut à droite, pour changer ton avatar et
                (sur mobile) te déconnecter.
              </>,
            ]}
          />
        </div>
        <Callout>
          <strong className="text-text">Un projet à la fois.</strong> Beaucoup de sections (Bookings, Casting,
          Essayages) travaillent sur « le projet actuel », affiché en haut de la page. Change de projet via{" "}
          <UI>Changer de projet</UI> en passant d&apos;un tournage à l&apos;autre.
        </Callout>
      </GuideChapter>

      <GuideChapter
        id="projets"
        icon={Clapperboard}
        title="Projets"
        audiences={["chef"]}
        intro="Un projet, c'est un tournage — un film, une série, une pub. Tout part de là : annonces, casting, bookings et documents sont toujours rattachés à un projet précis."
      >
        <Steps
          items={[
            <>
              Va dans <strong className="text-text">Projets</strong> → <UI>+ Nouveau projet</UI>.
            </>,
            <>
              Renseigne le nom, les dates, le lieu, la société de production et le·la réalisateur·ice — ces
              infos réapparaissent sur tous les documents générés.
            </>,
            <>
              Ajoute une <strong className="text-text">signature</strong> (convocations) et, si besoin, une
              <strong className="text-text"> photo de projet</strong> qui servira de logo sur tes annonces.
            </>,
            <>
              Configure le <strong className="text-text">barème</strong> et la{" "}
              <strong className="text-text">convention</strong> pour que les majorations se calculent
              automatiquement.
            </>,
          ]}
        />
        <Callout tone="yellow">
          <strong className="text-text">Boîte Gmail du projet (optionnel).</strong> Tu peux donner à un projet
          sa propre adresse d&apos;envoi, différente de la tienne.
        </Callout>
      </GuideChapter>

      <GuideChapter
        id="base-profils"
        icon={Users}
        title="Base Profils"
        audiences={["tous"]}
        intro="Le carnet d'adresses partagé de toute l'équipe : chaque figurant·e n'existe qu'une fois, quel que soit le nombre de projets sur lesquels il·elle travaille."
      >
        <Steps
          items={[
            <>
              <UI>+ Nouveau profil</UI>, ou laisse-le·la candidater directement via une annonce.
            </>,
            <>
              Complète les <strong className="text-text">mensurations</strong> et ajoute ses{" "}
              <strong className="text-text">photos</strong> — portrait, pied, selfie, et si besoin des photos
              en tenue.
            </>,
            <>
              Le calendrier de <strong className="text-text">disponibilités</strong> peut être rempli par toi
              ou directement par le figurant·e via son lien (à copier dans <UI>Disponibilités</UI>).
            </>,
            <>
              Active l&apos;<strong className="text-text">accès à l&apos;espace personnel</strong> pour qu&apos;il·elle
              se connecte et te réponde — le lien de connexion s&apos;envoie à la main, jamais automatiquement.
            </>,
          ]}
        />
        <MiniGrid
          items={[
            { title: "Vue Liste", body: "Pour filtrer par ville, tag, véhicule ou compte Myrole." },
            { title: "Vue Trombinoscope", body: "Pour parcourir les photos rapidement, comme un book." },
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="annonces"
        icon={Megaphone}
        title="Annonces"
        audiences={["chef", "assistant"]}
        intro="Une annonce est l'offre publique que tu diffuses pour recruter des figurant·es sur un projet — elle génère un lien de candidature et, si besoin, une affiche."
      >
        <Steps
          items={[
            "Crée l'annonce depuis un projet : titre, description, dates recherchées, questions éventuelles aux candidat·es.",
            <>
              Ajoute des photos de <strong className="text-text">moodboard</strong> pour donner le ton visuel
              recherché.
            </>,
            <>
              Copie le <strong className="text-text">lien public</strong>, télécharge le{" "}
              <strong className="text-text">QR code</strong> ou génère directement une{" "}
              <strong className="text-text">affiche</strong> pour Instagram/Facebook.
            </>,
            "Les candidatures arrivent automatiquement dans Candidatures, classées par annonce.",
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="candidatures"
        icon={FileText}
        title="Candidatures"
        audiences={["chef", "assistant"]}
        intro="Le tri des réponses reçues sur tes annonces — chaque candidature garde ses photos, son selfie de vérification et ses réponses aux questions posées."
      >
        <Steps
          items={[
            "Ouvre une candidature pour voir le profil complet et vérifier les photos.",
            <>
              Range-la dans un <strong className="text-text">onglet</strong> (à trier, retenu, refusé...) —
              personnalisables par projet.
            </>,
            <>
              Depuis la fiche, <UI>+ Ajouter à un booking</UI> pour la faire passer directement en tournage, ou
              envoie-la vers <strong className="text-text">Casting</strong> si tu veux d&apos;abord une vidéo.
            </>,
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="casting"
        icon={Video}
        title="Casting"
        audiences={["chef", "assistant"]}
        intro="Pour les rôles qui demandent une vérification avant booking : vidéo de présentation, photos ciblées, lien de bande démo."
      >
        <div>
          <p className="mb-2 text-sm font-semibold">Calibrer un rôle</p>
          <Steps
            items={[
              <>
                <UI>+ Nouveau casting</UI>, donne-lui un nom et une{" "}
                <strong className="text-text">catégorie de cachet</strong> (Rôle / Silhouette / Doublure).
              </>,
              "Choisis le nombre de vidéos et les photos demandées, et la date de tournage si elle est déjà connue.",
              "Personnalise, si besoin, le corps du mail d'invitation — sinon un message par défaut est généré avec le lien.",
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Ajouter des profils et inviter</p>
          <Steps
            items={[
              <>
                Depuis Base Profils, Bookings ou Candidatures, sélectionne des profils puis{" "}
                <UI>Ajouter au casting</UI> — choisis le rôle existant dans le menu déroulant.
              </>,
              <>
                Sélectionne les profils ajoutés, clique <UI>Invitation (avec le lien)</UI> puis{" "}
                <UI>Envoyer</UI> — l&apos;envoi est toujours manuel.
              </>,
              "Une fois la vidéo reçue, clique sur le profil pour la visionner et zoomer les photos, directement dans la page.",
            ]}
          />
        </div>
        <Callout>
          <strong className="text-text">Partage réal.</strong> Le lien{" "}
          <UI>Partage réal — Casting</UI> montre au réalisateur·ice uniquement les profils ayant déjà envoyé
          leur vidéo, classés par rôle — jamais les infos de contact.
        </Callout>
      </GuideChapter>

      <GuideChapter
        id="bookings"
        icon={BookOpen}
        title="Bookings"
        audiences={["chef", "assistant"]}
        intro="Le cœur du tournage : qui est booké, sur quelle journée, à quel cachet, et où en est sa convocation."
      >
        <Steps
          items={[
            <>
              Choisis le projet puis la <strong className="text-text">journée</strong> — elle se crée
              automatiquement dès le premier profil ajouté.
            </>,
            <>
              Renseigne <strong className="text-text">fonction</strong>,{" "}
              <strong className="text-text">cachet</strong> et <strong className="text-text">statut</strong>{" "}
              pour chaque profil.
            </>,
            "Envoie les convocations (individuellement ou en masse) et suis les réponses reçues.",
            "Depuis la journée, tu accèdes aussi au covoiturage, aux essayages liés et aux documents à générer.",
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="essayages"
        icon={Shirt}
        title="Essayages"
        audiences={["chef", "assistant"]}
        intro="Le planning HMC (habillage / maquillage / coiffure) et le suivi des numéros de costume par figurant·e."
      >
        <Steps
          items={[
            <>Crée des <strong className="text-text">créneaux</strong> sur une date d&apos;essayage, avec heure de début et de fin.</>,
            "Assigne les profils à un créneau — leurs mensurations apparaissent directement.",
            <>
              Renseigne le <strong className="text-text">numéro de costume</strong> une fois attribué : il
              réapparaîtra automatiquement sur les fiches de plateau.
            </>,
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="documents"
        icon={FolderOpen}
        title="Documents de plateau"
        audiences={["chef", "assistant"]}
        intro="Générés automatiquement depuis les données déjà saisies — plus de mise en page à la main pour chaque journée."
      >
        <MiniGrid
          items={[
            { title: "Trombinoscope", body: "Photos + infos choisies, groupées par heure et par cachet." },
            { title: "Fiches mensuration", body: "Une fiche par personne, avec ses trois photos et ses mesures." },
            { title: "Trombi HMC", body: "Variante pour l'équipe habillage/maquillage/coiffure." },
            { title: "Liste d'appel, bordereau, vCards", body: "Depuis Bookings → Documents, un onglet par type de document." },
          ]}
        />
        <p className="text-sm text-text-muted">
          Sur chaque document, <UI>Champs à afficher</UI> te permet de cocher ce que tu veux montrer (téléphone,
          email, âge, ville...), puis <UI>Télécharger le PDF</UI> ou <UI>Imprimer</UI>.
        </p>
      </GuideChapter>

      <GuideChapter
        id="partage"
        icon={Share2}
        title="Partage"
        audiences={["chef", "assistant"]}
        intro="Des liens en lecture seule à envoyer à la production, au réal ou à l'équipe HMC — sans leur donner accès au reste de l'outil."
      >
        <Steps
          items={[
            "Génère un lien pour une journée précise (documents) ou pour tout le casting d'un projet.",
            <>
              Choisis si le lien montre les <strong className="text-text">coordonnées</strong>{" "}
              (téléphone/email) — désactivé par défaut.
            </>,
            <>
              La personne qui reçoit le lien peut basculer les documents en{" "}
              <strong className="text-text">anglais</strong> via le bouton FR/EN — pratique pour une prod
              internationale.
            </>,
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="messagerie"
        icon={MessageCircle}
        title="Messagerie"
        audiences={["tous"]}
        intro="Chaque fiche figurant·e a son propre fil de discussion, visible uniquement par les cheffes concernées par ses projets en cours."
      >
        <Steps
          items={[
            <>Écris un message libre depuis la fiche, ou utilise un <strong className="text-text">modèle</strong> pré-rempli.</>,
            <>Coche <strong className="text-text">Notifier par email</strong> pour que le message parte aussi par mail.</>,
            <>Le figurant·e doit cocher <UI>BIEN REÇU</UI> sur tes messages avant de pouvoir répondre à son tour.</>,
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="equipe"
        icon={UsersRound}
        title="Équipe & boîte mail"
        audiences={["chef"]}
        intro="Pour inviter du monde et faire en sorte que tes emails partent bien depuis ta propre adresse."
      >
        <div>
          <p className="mb-2 text-sm font-semibold">Inviter un·e assistant·e</p>
          <Steps
            items={[
              "Va dans Équipe, choisis le projet concerné et l'email de la personne.",
              "Elle reçoit une invitation par email pour créer son compte — son accès reste limité à ce projet.",
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Configurer ta boîte Gmail</p>
          <Steps
            items={[
              <>
                Toujours dans Équipe, section <UI>Ta boîte d&apos;envoi Gmail</UI>.
              </>,
              "Crée un mot de passe d'application sur ton compte Google (guide affiché juste en dessous), puis colle-le avec ton adresse.",
            ]}
          />
        </div>
        <Callout tone="yellow">
          <strong className="text-text">Obligatoire si tu n&apos;es pas le compte principal.</strong> Sans
          boîte configurée, l&apos;envoi de tout message (convocations, casting, espace perso...) est bloqué —
          c&apos;est voulu, pour qu&apos;aucun message ne parte jamais depuis l&apos;adresse d&apos;une autre
          cheffe.
        </Callout>
      </GuideChapter>

      <GuideChapter
        id="autres"
        icon={Settings}
        title="Modèles, Barème, RGPD"
        audiences={["chef", "assistant"]}
        intro="Trois sections d'appoint, moins utilisées au quotidien mais bonnes à connaître."
      >
        <MiniGrid
          items={[
            { title: "Modèles", body: "Enregistre des messages type (convocation, relance...) réutilisables partout où tu envoies un message." },
            { title: "Barème", body: "Référence des cachets et majorations ACFDA appliqués automatiquement selon la convention du projet." },
            { title: "RGPD", body: "Outils d'anonymisation pour les profils qui demandent la suppression de leurs données." },
          ]}
        />
      </GuideChapter>

      <p className="text-center text-xs text-text-muted">
        Une question, un écran qui ne correspond plus à ce guide ?{" "}
        <Link href="/equipe" className="text-coral hover:underline">
          Préviens ta cheffe de casting
        </Link>{" "}
        — ce guide est mis à jour à chaque nouvelle fonctionnalité livrée.
      </p>
    </div>
  );
}
