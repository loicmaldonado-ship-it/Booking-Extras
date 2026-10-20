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
            className="rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-coral/60 hover:text-text"
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
                <strong className="text-text">Cloche</strong> — notifications de ton équipe (candidatures, comptes
                candidat créés, vidéos de casting), regroupées par annonce ou par projet : la flèche d&apos;un
                groupe montre le détail. Ce qui est lu l&apos;est pour toute l&apos;équipe du projet, jamais pour
                les autres cheffes. <UI>Tout marquer comme lu</UI> en haut du panneau.
              </>,
              <>
                <strong className="text-text">Ta photo</strong> — en haut à droite, pour changer ton avatar et
                (sur mobile) te déconnecter. <UI>Mon profil</UI> dans ce menu ouvre ta fiche membre.
              </>,
            ]}
          />
        </div>
        <Callout>
          <strong className="text-text">Un projet à la fois.</strong> Beaucoup de sections (Bookings, Casting,
          Essayages) travaillent sur « le projet actuel », affiché en haut de la page. Change de projet via{" "}
          <UI>Changer de projet</UI> en passant d&apos;un tournage à l&apos;autre.
        </Callout>
        <Callout tone="yellow">
          <strong className="text-text">Fiche membre obligatoire (chef·fes).</strong> Photo, nom, prénom et
          téléphone sont demandés à la première connexion sur <UI>Mon profil</UI> — impossible d&apos;utiliser le
          reste de l&apos;appli tant qu&apos;elle n&apos;est pas complète.
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
              <strong className="text-text">Pas de libre service</strong> : pour ouvrir un profil, cherche-le par son nom,
              prénom, email ou téléphone (3 lettres minimum, 30 résultats au plus). Seuls Loïc, Mathieu et Eléa voient la
              liste complète. Eux seuls peuvent aussi <strong className="text-text">révoquer l&apos;accès</strong> d&apos;un
              compte (espace candidat·e d&apos;un profil, ou assistant·e dans Équipe).
            </>,
            <>
              <UI>+ Nouveau profil</UI>, ou laisse-le·la candidater directement via une annonce : dès
              qu&apos;une personne a créé son compte, elle apparaît dans la Base Profils (avec son âge, calculé
              d&apos;après sa date de naissance, sous son nom). Identité,
              contact, genre et pronom, adresse complète (rue, code postal, ville), commune de naissance et
              une photo portrait sont obligatoires — le reste (mensurations, véhicule) peut attendre. Coche{" "}
              <UI>Comédien·ne</UI> pour créer un profil minimal (juste le nom) et faire apparaître sa{" "}
              <strong className="text-text">tranche d&apos;âge</strong> et les coordonnées de son{" "}
              <strong className="text-text">agent</strong> (nom, agence, email, téléphone), rattachées à la fiche.
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
              Pour une personne <strong className="text-text">ajoutée à la main</strong> (sans compte), active
              l&apos;accès à l&apos;espace personnel et envoie-lui le lien de création de compte, pour qu&apos;elle
              se connecte et te réponde. Une personne qui a créé son compte elle-même se connecte seule : la fiche
              affiche « A créé son compte » et aucun lien ne lui est envoyé.
            </>,
          ]}
        />
        <Callout>
          <strong className="text-text">Profil : Figurant·es / Comédien·nes.</strong> Les deux pools sont
          toujours séparés — bascule d&apos;un clic en haut de la page. Coche <UI>Comédien·ne</UI> sur un profil
          pour qu&apos;il apparaisse dans le second, jamais mélangé avec la figuration.
        </Callout>
        <Callout>
          <strong className="text-text">Fiche incomplète.</strong> Depuis son espace, le·la figurant·e voit
          « Ma fiche » automatiquement ouverte en édition, avec la liste des champs obligatoires manquants —
          pratique quand tu renvoies le lien de connexion justement pour lui faire compléter une info.
        </Callout>
        <Callout>
          <strong className="text-text">👁️ Aperçu.</strong> Depuis une carte ou une ligne, ouvre les bookings et
          les échanges (dont les réponses mail) sans quitter la page — <UI>‹</UI>/<UI>›</UI> font passer au
          profil suivant sans refermer, en restant dans les résultats déjà filtrés.
        </Callout>
        <MiniGrid
          items={[
            {
              title: "Vue Liste",
              body: "Pour filtrer par ville, véhicule, genre, âge ou compte Myrole — et, dans « Code postal & mensurations », par code postal ou n'importe quelle mensuration de la fiche (taille, poids, tours, veste/pantalon...).",
            },
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
            "Crée l'annonce depuis un projet : titre, description, dates recherchées, questions éventuelles aux candidat·es (un clic sur une question proposée l'ajoute : celles de ton équipe, puis des questions courantes prêtes à l'emploi).",
            <>
              Pour un tournage sur plusieurs semaines, ajoute une <strong className="text-text">période</strong>{" "}
              (du … au …) dans les dates de l&apos;annonce : un jour est créé par date (retire ceux sans tournage
              avec ×), et les candidat·es cochent seulement leurs <strong className="text-text">indispos</strong>{" "}
              sur un calendrier au lieu de répondre date par date.
            </>,
            <>
              Coche le·s <strong className="text-text">type·s de profil recherché</strong> (Figurant, Silhouette,
              Doublure...) — affiché sur l&apos;annonce publique pour que les candidat·es sachent d&apos;emblée ce
              qui est recherché.
            </>,
            <>
              Ajoute des photos de <strong className="text-text">moodboard</strong> pour donner le ton visuel
              recherché.
            </>,
            <>
              Copie le <strong className="text-text">lien public</strong>, télécharge le{" "}
              <strong className="text-text">QR code</strong> ou publie l&apos;
              <strong className="text-text">affiche</strong> : choisis <UI>Post carré</UI> ou <UI>Story</UI>,
              puis <UI>Partager l&apos;affiche</UI> (sur téléphone, ouvre directement Instagram, WhatsApp,
              Messages…), <UI>Télécharger</UI> ou <UI>Copier l&apos;image</UI>.
            </>,
            <>
              Pour personnaliser l&apos;affiche, ouvre <UI>Modifier</UI> sur l&apos;annonce. Trois blocs :{" "}
              <strong className="text-text">Fond</strong> (couleur, ou <UI>Origine</UI> pour le style de base),{" "}
              <strong className="text-text">Titre</strong> (police et couleur) et{" "}
              <strong className="text-text">Texte</strong> (police, couleur et taille des infos et de la
              description). <UI>Auto</UI> = blanc ou noir selon le fond, toujours lisible ; si une couleur choisie
              se lit mal, un avertissement propose de revenir en Auto. L&apos;aperçu (post ou story) se met à jour
              en direct ; rien n&apos;est enregistré avant <UI>Enregistrer</UI>.
            </>,
            "Les candidatures arrivent automatiquement dans Candidatures, classées par annonce.",
          ]}
        />
        <Callout>
          <strong className="text-text">Compte obligatoire pour postuler.</strong> La page d&apos;accueil du site
          présente Booking Extras et liste les annonces ouvertes ; on peut y créer son compte sans annonce (profil
          complet et photos). Sans compte, la personne remplit l&apos;annonce puis crée son mot de passe pour valider
          sa candidature ; si son email est déjà connu, elle doit d&apos;abord se connecter (mot de passe ou lien
          reçu par email) et revient sur l&apos;annonce avec ses infos déjà remplies. Si sa fiche a été ajoutée par
          l&apos;équipe sans compte (ajout rapide), pas de doublon : elle reçoit à cette adresse un lien{" "}
          <UI>Crée ton compte</UI> (valable 30 jours), choisit son mot de passe et revient sur l&apos;annonce. Les candidat·es se
          connectent sur <UI>Espace candidat·es</UI> (/compte/connexion) ; questions générales :
          bookingextras.support@gmail.com. Photos : chaque candidature garde les siennes (envoyées pour
          l&apos;annonce, ou reprises parmi celles du compte avec <UI>Mes photos</UI>).
        </Callout>
        <Callout>
          <strong className="text-text">Agent.</strong> Si l&apos;annonce coche le type{" "}
          <UI>Rôle</UI>, le formulaire de candidature demande en plus les coordonnées de l&apos;agent (nom,
          agence, email, téléphone) — ou <UI>Je n&apos;ai pas d&apos;agent</UI> si le·la candidat·e n&apos;en a
          pas.
        </Callout>
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
            <>
              <strong className="text-text">Un onglet par étape du tri</strong> : <UI>📥 À trier</UI> (ouvert par
              défaut), <UI>✅ Retenu</UI>, <UI>🤔 Peut-être</UI>, tes onglets perso, <UI>👥 Tous</UI> et{" "}
              <UI>🚫 OUT</UI>. Chaque onglet affiche son nombre de profils avec les filtres en cours.{" "}
              <UI>＋ Onglet</UI> en crée un sur cette annonce seulement (les autres cheffes et tes autres annonces ne le
              voient pas).
            </>,
            <>
              <strong className="text-text">Une seule barre de filtres</strong> : recherche par prénom, nom ou email,
              genre, âge, dispo par date, réponse à une question, et <UI>＋ Plus de filtres</UI> (Myrole, véhicule, code
              postal, mensurations). Les filtres actifs s&apos;affichent en dessous, chacun se retire d&apos;un clic sur{" "}
              <UI>×</UI>. La recherche signale aussi les personnes trouvées dans un autre onglet ou déjà envoyées dans une
              journée. Les boutons <UI>Trier :</UI> rangent par arrivée, nom, âge ou habitué·es, et s&apos;appliquent tout de suite ; les actions sur la sélection (étiqueter, réserve, casting, booking) s&apos;ouvrent dans une fenêtre qui affiche le résultat et se ferme avec <UI>Fermer</UI> ; <UI>🖼️ Trombi</UI> /{" "}
              <UI>☰ Liste</UI> change l&apos;affichage.
            </>,
            <>
              Sur chaque carte : âge, ville, badge <UI>Habitué·e</UI> et dates. Passe la souris sur la photo, ou touche{" "}
              <UI>💬 Lire le message</UI> (iPad, téléphone) : elle se retourne et montre le{" "}
              <strong className="text-text">message de candidature</strong> en entier (il défile s&apos;il est long) et
              les réponses aux questions. <UI>↩ Revoir la photo</UI> la remet à l&apos;endroit. En vue <UI>☰ Liste</UI>, le message a sa colonne. Sous la photo, <UI>✅</UI> <UI>🤔</UI> <UI>🚫</UI> rangent la personne d&apos;un clic
              (re-cliquer la remet à trier). Coche plusieurs cartes pour les ranger d&apos;un coup dans n&apos;importe
              quel onglet, les ajouter au casting ou les envoyer dans une autre journée.
            </>,
            <>
              <UI>⚡ Trier un par un</UI> : chaque personne s&apos;affiche en grand (photos, message en entier, dispos,
              réponses) et tu la ranges d&apos;un clic ou d&apos;une touche (<UI>1</UI> Retenu, <UI>2</UI> Peut-être…{" "}
              <UI>0</UI> la remet à trier), puis la suivante arrive toute seule. <UI>←</UI> <UI>→</UI> pour naviguer,{" "}
              <UI>↑</UI> <UI>↓</UI> pour les photos, <UI>Échap</UI> pour fermer. Un clic sur le nom ou la photo
              d&apos;une carte ouvre cette même vue sur elle (Cmd/Ctrl-clic ouvre sa page détaillée).
            </>,
            <>
              <strong className="text-text">Une place par profil, comme dans un classeur.</strong> Chaque date de
              l&apos;annonce a son <strong className="text-text">onglet de journée</strong> (📅 Jeu 22/10), créé tout
              seul avec la date, à côté de Retenu, Peut-être et de tes onglets : ranger un profil dans une journée, c&apos;est
              le mettre dans cet onglet (il n&apos;a qu&apos;une place à la fois, rien n&apos;est créé dans Bookings). Pour
              changer un profil de place : <UI>📍</UI> sur sa carte (un tap, tous les onglets proposés), les boutons
              ✅ 🤔 🚫, les pastilles de date (touches <UI>A</UI> <UI>Z</UI> <UI>E</UI>… dans le tri un par un), ou coche
              plusieurs profils puis <UI>Ranger dans :</UI>. Dans un onglet de journée, un rappel indique le nombre en
              booking face au besoin et mène à la journée dans Bookings.
            </>,
            <>
              <strong className="text-text">Étiquettes.</strong> Pour ce qui ne change pas la place : Marc est dans
              « Jeu 22/10 » <em>et</em> a un vélo → <UI>＋ Étiquette</UI> sur sa carte (ou coche des profils puis{" "}
              <UI>🏷️ Étiqueter</UI> : <UI>＋ Poser</UI> / <UI>− Retirer</UI>, ou <UI>Créer et poser</UI> une nouvelle).
              Les étiquettes sont communes aux annonces d&apos;un même projet, et le menu{" "}
              <UI>🏷️ Étiquette</UI> de la barre de filtres retrouve tous les profils qui la portent, dans n&apos;importe
              quel onglet.
            </>,
            <>
              <strong className="text-text">Envoyer en booking.</strong> Coche des profils puis{" "}
              <UI>📋 Envoyer en booking</UI> : choisis la date, le booking est créé (en PER, rien n&apos;est envoyé aux
              figurant·es) et la personne quitte Candidatures. Le <strong className="text-text">cachet est obligatoire</strong>,
              la fonction peut attendre. <UI>Tout cocher</UI> dans un onglet de journée envoie toute la journée d&apos;un
              coup. <UI>📋 Envoyer en booking sur une autre date</UI> sert pour une date hors annonce. Pas décidé·es ?{" "}
              <UI>🗄️ Mettre en réserve</UI> les met de côté, à retrouver avec leurs dispos dans le bouton 🗄️ Réserve de Bookings.
            </>,
            <>
              <strong className="text-text">Écrire aux candidat·es</strong> : <UI>💬</UI> à côté d&apos;un nom, ou
              coche des profils puis <UI>💬 Message</UI> : message libre seulement (pas de modèles ici). Mail (depuis la
              boîte du projet, confirmation avant un envoi groupé) ou <UI>📱 En textos</UI>. Les trombis, eux, se font
              dans la journée de Bookings.
            </>,
            <>
              <strong className="text-text">OUT</strong> : la candidature disparaît de l&apos;annonce (« Tous » et
              les autres onglets) et n&apos;en reste la trace que dans l&apos;onglet <UI>OUT</UI>. La personne reçoit
              dans son espace : « Désolé, vous n&apos;avez pas été retenu·e pour l&apos;annonce … Un grand merci pour
              votre candidature, et à tout bientôt ! L&apos;équipe Booking Extras ». Sortie de OUT par erreur, le
              message est retiré.
            </>,
            <>
              Depuis la fiche, <UI>+ Ajouter à un booking</UI> pour la faire passer directement en tournage, ou
              envoie-la vers <strong className="text-text">Casting</strong> si tu veux d&apos;abord une vidéo.
            </>,
          ]}
        />
        <Callout>
          <strong className="text-text">Filtres et ordre.</strong> Si l&apos;annonce a des dates, les pastilles{" "}
          <UI>Dispo le</UI> filtrent en un clic (plusieurs cochées = dispo sur toutes). La ligne <UI>Ordre</UI>{" "}
          classe par date de candidature, par âge ou met les habitué·es en premier. En plus du genre, du véhicule,
          de l&apos;âge et du compte Myrole, le panneau <UI>Code postal &amp; mensurations</UI> filtre par code
          postal ou par n&apos;importe quelle mensuration de la fiche.
        </Callout>
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
                <UI>+ Nouveau casting</UI>, donne-lui un nom, une{" "}
                <strong className="text-text">catégorie de cachet</strong> (Rôle / Silhouette / Doublure) et un{" "}
                <strong className="text-text">mode de casting</strong> (Présentiel / Selftape) — indicatif
                seulement, l&apos;envoi du lien selftape et l&apos;ajout au planning présentiel restent tous les
                deux disponibles quel que soit le mode choisi.
              </>,
              <>
                Choisis le nombre de vidéos et les photos demandées, et la date de tournage si elle est déjà
                connue. Renseigne aussi <strong className="text-text">« Jusqu&apos;au »</strong> si tu n&apos;as
                encore qu&apos;une période (« un ou deux jours de tournage entre le X et le Y ») plutôt qu&apos;une
                date précise — ça s&apos;affiche « Du X au Y » partout et se glisse automatiquement dans le mail
                d&apos;invitation.
              </>,
              <>
                Calibre une <strong className="text-text">date limite d&apos;envoi</strong> (optionnel) : elle
                s&apos;affiche sur la carte de chaque profil et dans le mail d&apos;invitation, et bloque
                l&apos;envoi côté candidat une fois passée.
              </>,
              "Personnalise, si besoin, le corps du mail d'invitation — sinon un message par défaut est généré avec le lien.",
              <>
                Ajoute des <strong className="text-text">questions</strong> (une par ligne, ex. « Parlez-vous anglais
                ? ») : la personne répond oui / non (avec une précision si elle veut) en envoyant ses photos et
                vidéos. Les réponses s&apos;affichent sur sa carte, et sur le lien réal avec son âge, ses
                mensurations et les photos de son profil. Pour les rôles <strong className="text-text">silhouette</strong>{" "}
                et <strong className="text-text">doublure</strong>, le lien réal propose aussi d&apos;office les{" "}
                <UI>📏 Fiches de mensuration</UI> du rôle (sans téléphone ni email).
              </>,
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
                Quelqu&apos;un qui n&apos;est pas dans la base ? Dans le rôle, <UI>⚡ Ajout rapide</UI> : une photo,
                prénom, nom, email et téléphone suffisent (enchaîne plusieurs personnes à la suite). La fiche va dans
                ta <UI>📇 Base casting</UI> ; envoie ensuite l&apos;invitation avec le lien : en envoyant ses photos
                et vidéos, la personne complète elle-même sa fiche (date de naissance, ville, mensurations).
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
          <strong className="text-text">Envoi des vidéos : direct, sans compression.</strong> Le·la candidat·e
          choisit sa vidéo (ou glisse-la) et elle <strong className="text-text">part tout de suite</strong>, telle
          quelle, pendant qu&apos;il·elle remplit sa fiche : barre de progression avec le temps restant, reprise
          automatique si le réseau coupe, <UI>Annuler</UI> / <UI>Réessayer</UI> à tout moment. Le bouton{" "}
          <UI>Envoyer</UI> s&apos;active dès que la vidéo est arrivée. Côté équipe, sur la carte d&apos;un profil,{" "}
          <UI>＋ Ajouter des vidéos</UI> (ou glisse plusieurs fichiers) : elles partent l&apos;une après
          l&apos;autre dans l&apos;ordre choisi et s&apos;ajoutent toutes seules au profil, avec le nom du
          fichier (à changer ensuite sur la vidéo). Taille maximale : 2 Go par vidéo. Une fois la vidéo ajoutée au profil, le
          site l&apos;<strong className="text-text">allège tout seul en arrière-plan</strong> (720p, quelques minutes
          au plus) et remplace le fichier : rien à faire, et l&apos;original reste en place si l&apos;allègement échoue
          ou si la vidéo est trop lourde (plus de 300 Mo) ou trop longue (plus de 4 min). Les photos, elles, sont
          réduites avant l&apos;envoi.
        </Callout>
        <Callout>
          <strong className="text-text">Partage réal.</strong> Le lien{" "}
          <UI>Partage réal — Casting</UI> montre au réalisateur·ice les rôles et profils que tu as
          explicitement marqués visibles, jamais les infos de contact. Les profils <UI>Validé·e</UI> montent en haut,
          dans <UI>Profils validés</UI>, avec leur rôle et sa date sur chaque carte ; en dessous, <UI>Profils à valider</UI>
          garde ceux qui ne le sont pas encore, tant que tu ne les as pas mis en invisible (un rôle sans profil est
          simplement cité en bas). Chaque profil affiche{" "}
          <UI>Validé·e</UI> ou <UI>À valider</UI> selon son statut. Les boutons{" "}
          <UI>👁️ Visible</UI> / <UI>🙈 Invisible</UI> à côté de la catégorie du rôle (Rôle/Silhouette/Doublure)
          montrent ou cachent le rôle entier d&apos;un clic, sans passer par <UI>Calibrer</UI> — utile pour une
          silhouette que tu ne veux plus montrer. Le numéro à côté du nom du rôle est sa position (ici comme
          sur le lien réal) — change-le pour déplacer le rôle à cette place, les autres se décalent tout seuls.
        </Callout>
        <Callout>
          <strong className="text-text">Rôles, silhouettes, doublures : trois onglets.</strong> En haut de la page
          Casting, <UI>Rôles</UI> / <UI>Silhouettes</UI> / <UI>Doublures</UI> (avec le nombre de profils) : chaque
          onglet a ses propres castings, et <UI>+ Nouveau casting</UI> propose la catégorie de l&apos;onglet ouvert.
          Tout en bas, deux liens <UI>Partage réal</UI> : un <strong className="text-text">lien séparé</strong> pour la
          catégorie de l&apos;onglet (le·la réal ne voit que les silhouettes, par exemple), et un lien{" "}
          <UI>Tout le casting</UI> qui range les profils par catégorie (Rôles, Silhouettes, Doublures) dans{" "}
          <UI>Profils validés</UI> puis <UI>Profils à valider</UI>. Tu choisis : un seul lien pour tout, ou plusieurs
          liens séparés — chaque lien a ses propres réglages, son titre et son suivi, et les avis reçus restent sur le
          profil dans l&apos;espace casting.
        </Callout>
        <Callout>
          <strong className="text-text">Réglages du lien réal.</strong> Sous <UI>Partage réal</UI> (bas de la page
          Casting), tu choisis ce que le·la réal voit : <UI>Âge</UI>, <UI>Ville</UI>, <UI>Taille</UI>,{" "}
          <UI>Autres mensurations</UI>, <UI>Réponses aux questions du rôle</UI> (le nom, les vidéos et les photos
          sont toujours montrés ; une info décochée n&apos;est même pas envoyée à la page), et ce qu&apos;il·elle peut
          faire : <UI>Avis Oui / Peut-être / Non</UI> sur chaque profil et <UI>Commentaires par profil</UI>. Un
          profil ouvre une <strong className="text-text">salle de visionnage</strong> : rien ne démarre à
          l&apos;ouverture ; <UI>Lancer la vidéo</UI> la lit <strong className="text-text">en plein écran</strong> (sans
          aperçu de photo avant), puis les vidéos <strong className="text-text">s&apos;enchaînent</strong>{" "}
          (essai suivant, puis profil suivant du rôle ; case <UI>Enchaîner les vidéos</UI> pour couper), avec ses
          essais en onglets, les photos, la fiche, puis son avis et ses commentaires ; flèches ‹ › pour passer au
          profil suivant du rôle. La barre du lecteur se masque toute seule pendant la lecture (elle revient au mouvement ou en pause). L&apos;avis et les commentaires par profil sont activés par défaut ; l&apos;avis Oui / Peut-être / Non disparaît sur un profil déjà validé. Les profils
          s&apos;affichent en cartes de taille raisonnable, même quand il n&apos;y en a qu&apos;un. Le prénom du·de la réal n&apos;est demandé qu&apos;au premier avis ou commentaire.
          De ton côté, la carte du profil montre les avis (<UI>✓ Martine</UI>) et le nombre de commentaires, et
          chaque avis ou commentaire t&apos;envoie une alerte ; les commentaires par profil apparaissent aussi dans
          le fil <UI>💬</UI> du lien, avec le nom du profil.
        </Callout>
        <Callout>
          <strong className="text-text">Filtrer les profils.</strong> Au-dessus des rôles, filtre tous les
          profils du casting avec les boutons <UI>Mode</UI> (Selftape / Présentiel) et/ou <UI>Statut</UI> (appliqués dès le clic) — pratique pour
          repérer d&apos;un coup d&apos;œil, par exemple, tout ce qui reste <UI>Incomplet</UI> quel que soit le
          rôle.
        </Callout>
        <Callout>
          <strong className="text-text">Statut &amp; agent.</strong> Chaque profil a un{" "}
          <strong className="text-text">statut</strong> — <UI>Incomplet</UI> puis <UI>À traiter</UI> (se met
          tout seul dès que le candidat a fini d&apos;envoyer ce qui était demandé), et c&apos;est à toi de
          repasser en <UI>Complet</UI> une fois le contenu relu et validé — jamais automatique. Puis la même
          suite que les bookings jusqu&apos;à <UI>Validé</UI> (affiche un rond ✓ sur la photo). Sélectionne
          plusieurs profils (case en haut de chaque carte), ou <UI>Tout sélectionner</UI> au-dessus de la liste
          pour tous les prendre d&apos;un coup, pour changer leur statut ou envoyer un message groupé. Pour un rôle
          de catégorie <strong className="text-text">Rôle</strong>,{" "}
          <UI>+ Ajouter un agent</UI> apparaît sous chaque profil pour garder ses coordonnées à portée de main
          (agence comprise). En tapant son nom, les agents déjà rentrés une fois (sur n&apos;importe quelle
          fiche) apparaissent en suggestion — cliquer dessus remplit agence, email et téléphone d&apos;un coup.
          La base complète (Admin → Base Agents) reste réservée au compte propriétaire.
        </Callout>
        <Callout>
          <strong className="text-text">👁️ Visible / 🙈 Invisible.</strong> Un profil qui a envoyé sa vidéo
          n&apos;apparaît plus automatiquement au réal — passe-le en <UI>Visible</UI> pour qu&apos;il
          apparaisse sur le lien, même avant d&apos;avoir tout reçu : c&apos;est toi qui décides, pas un
          critère automatique. <UI>Invisible</UI> le retire du lien sans rien supprimer. Même logique au
          niveau du rôle entier (<UI>Visible sur le lien de partage réal</UI> en calibrant) : coche-la et le
          rôle apparaît tout de suite, même sans aucun profil visible dedans pour l&apos;instant — décoche-la
          et le rôle reste caché du réal, quels que soient les profils marqués visibles dedans.{" "}
          <UI>👁️ Tous visibles</UI> / <UI>🙈 Tous invisibles</UI>, au-dessus de la liste des profils, bascule
          d&apos;un coup tous les profils de ce rôle (pas les autres rôles du casting).
        </Callout>
        <Callout>
          <strong className="text-text">🖼️ Photo de la vignette.</strong> Sur la carte d&apos;un profil, le bouton{" "}
          <UI>🖼️</UI> choisit la photo affichée en vignette, parmi les photos de sa fiche et celles envoyées pour
          ce rôle. Elle s&apos;applique dans Casting, sur le lien réal, les trombis et les documents du casting
          (liste artistique, fiches rôles, distribution). <UI>Revenir à l&apos;automatique</UI> reprend la photo
          d&apos;essayage du projet, sinon le portrait.
        </Callout>
        <Callout>
          <strong className="text-text">🎥 Selftape / 📅 Présentiel par profil.</strong> Chaque profil hérite du
          mode du rôle à l&apos;ajout, mais se rebascule individuellement d&apos;un clic — pratique pour repérer
          d&apos;un coup d&apos;œil qui doit recevoir un lien vidéo et qui doit avoir un créneau en présentiel.
        </Callout>
        <Callout>
          <strong className="text-text">Mails aux profils d&apos;un rôle.</strong> Quand un profil a un agent
          renseigné, son adresse est automatiquement mise en <strong className="text-text">copie</strong> à
          l&apos;envoi. En calibrant le rôle, joins un{" "}
          <strong className="text-text">PDF</strong> (ex. extrait de script) : il part en pièce jointe à chaque
          mail envoyé depuis ce rôle. Le modèle <UI>Convocation présentiel</UI> remplit automatiquement{" "}
          {"{lieu}"} et {"{horaire}"} pour les profils déjà programmés en casting présentiel (sinon un texte à
          confirmer s&apos;affiche) — pas besoin de retourner sur la page du planning pour convoquer. Dans les
          mails de convocation, le rôle, le projet ressortent en <strong className="text-text">gras</strong>, la
          signature en <em>italique</em> — toujours en dernier, après le corps du message.
        </Callout>
        <Callout>
          <strong className="text-text">🖼️ Trombis.</strong> Vue photos plus grandes, rangée par rôle, avec les
          mêmes filtres que Bookings (genre, véhicule, Myrole, âge, statut), l&apos;agent (ou « SANS AGENT ») sous
          chaque profil, et un raccourci <UI>Validé·es uniquement</UI> pour ne montrer que les profils retenus.
          Exportable en PDF (<UI>Télécharger le PDF</UI> ou impression).
        </Callout>
        <Callout>
          <strong className="text-text">📋 Liste artistique / 🪪 Fiches rôles validés.</strong> Deux documents
          exportables en PDF et en Excel, sous la liste des rôles — tous deux ne gardent que les rôles avec un
          comédien validé (les rôles pas encore tranchés n&apos;y apparaissent pas). La{" "}
          <UI>Liste artistique</UI> reprend ces rôles dans leur ordre d&apos;affichage, avec la photo du
          comédien et son agent. Les <UI>Fiches rôles validés</UI> font une fiche par rôle (grande photo,
          coordonnées, agent). Rends-les visibles et téléchargeables sur le lien réal via les cases à cocher
          sous <UI>Partage réal</UI>, en bas de la page.
        </Callout>
        <Callout>
          <strong className="text-text">📅 Présentiel.</strong> Pour organiser une session de casting en
          présentiel plutôt que par vidéo : renseigne le <strong className="text-text">lieu</strong> de la
          journée (clique dessus, en haut de la page). Les flèches de part et d&apos;autre de la date, en haut,
          passent à la journée précédente/suivante sans repasser par la liste. Crée des{" "}
          <strong className="text-text">journées</strong> sur un calendrier puis des{" "}
          <strong className="text-text">créneaux</strong> horaires, exactement comme pour un essayage — mais sans
          lien de partage avec l&apos;équipe. Glisse les profils sur un créneau, sélectionne-les puis envoie une{" "}
          <strong className="text-text">convocation</strong> : {"{lieu}"} et {"{horaire}"} sont remplis
          automatiquement par profil (lieu de la journée, créneau assigné). Exporte le{" "}
          <UI>Planning (PDF)</UI> en mode <UI>Liste</UI> (photo, nom, rôle, téléphone, statut) ou{" "}
          <UI>Trombi</UI> (photos plus grandes, groupées par créneau). Le rôle de chaque profil se modifie
          directement depuis la journée, et depuis la page Casting, sélectionne des profils dans un rôle puis{" "}
          <UI>→ Planning présentiel</UI> pour les envoyer d&apos;un coup vers une journée (et un créneau si tu en
          choisis un) sans repasser par la recherche nom par nom. Si une personne prévue en présentiel ne peut
          finalement pas se déplacer, envoie-lui simplement le lien selftape par mail comme pour un rôle
          classique — les deux options restent toujours ouvertes sur le même profil. Le menu déroulant{" "}
          <UI>Créneau</UI> (dans « → Planning présentiel ») affiche qui est déjà calé sur chaque horaire, pour ne
          jamais en mettre deux fois. La recherche <UI>+ Ajouter un profil</UI> depuis la journée ne propose que
          les profils déjà dans un rôle de ce projet — pas toute la base. Choisis un rôle dans le menu déroulant
          pour voir directement tous ses profils, sans même avoir à taper un nom.
        </Callout>
        <Callout>
          <strong className="text-text">Notes.</strong> Un petit champ sous chaque profil (rôle ou casting
          présentiel) pour noter une spécificité repérée — se sauvegarde tout seul en quittant le champ.
        </Callout>
        <Callout tone="yellow">
          <strong className="text-text">Signature.</strong> Chaque message envoyé se termine par la signature du
          projet si elle est calibrée (Projets → Signature), sinon par ton nom — jamais une formule générique.
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
              <strong className="text-text">🔗 Lien de validation MES</strong> (page Bookings du projet, sous les
              journées) — la validation MES ne se fait que depuis Bookings : <UI>📅 Créer le lien de toutes les
              journées</UI> montre à la mise en scène chaque journée à venir (et les journées passées qui ont encore des
              profils à valider) avec les profils au statut{" "}
              <UI>Proposé MES</UI> (photos, âge, mensurations, fonction, jamais les coordonnées). Un profil qui change de
              statut quitte le lien. Elle répond{" "}
              <UI>✅ Oui</UI> ou <UI>🚫 Non</UI> et peut commenter ; le lien se met à jour tout seul. Dans la journée, le
              badge <UI>🎬 Validé MES</UI> s&apos;affiche à côté du nom.
            </>,
            <>
              Choisis le projet puis la <strong className="text-text">journée</strong> — elle se crée
              automatiquement dès le premier profil ajouté. Une journée vide (aucun booking) peut être
              supprimée depuis sa carte, via le <UI>×</UI> qui apparaît en haut à droite.
            </>,
            <>
              Quelqu&apos;un qui n&apos;est pas dans la base ? Dans la journée, <UI>⚡ Ajout rapide</UI> : choisis une
              fois la <strong className="text-text">fonction</strong> et le{" "}
              <strong className="text-text">cachet</strong> (obligatoires, gardés pour toute la série), puis une
              photo, prénom, nom, email et/ou téléphone, et enchaîne les personnes. La fiche va dans la Base Profils{" "}
              <strong className="text-text">sans compte</strong>, et un mail (depuis la boîte du projet) lui propose de
              créer son compte en choisissant un mot de passe. Une fiche déjà connue (même email, ou même nom + même
              téléphone) est reprise, jamais dupliquée. Si quelqu&apos;un <strong className="text-text">ressemble</strong>{" "}
              (même nom aux accents ou tirets près, nom à une lettre près, même téléphone écrit autrement), un encadré{" "}
              <UI>⚠️ Cette personne est peut-être déjà dans la base</UI> montre sa photo, son âge et sa ville : rien
              n&apos;est créé tant que tu n&apos;as pas choisi <UI>✅ C&apos;est elle / lui</UI> (sa fiche est reprise,
              email ou téléphone manquants complétés) ou <UI>➕ Non, créer une nouvelle fiche</UI>. Sans email, aucun
              mail ne part.
            </>,
            <>
              <strong className="text-text">🗄️ Réserve</strong> (bouton en haut de la page Bookings du projet : une page à part, en trombinoscope) : les
              profils qu&apos;on met de côté parce qu&apos;on ne sait pas encore quoi en faire, mais qu&apos;on
              recontactera peut-être. On y envoie depuis Candidatures (coche, puis <UI>🗄️ Mettre en réserve</UI> : ils
              quittent la liste) ou depuis une journée (coche, puis <UI>🗄️ Mettre en réserve</UI> : le booking est retiré
              de la journée, sans message). Chaque profil rappelle <strong className="text-text">où il a postulé</strong> et
              quand, et les <strong className="text-text">dates qu&apos;il a données dispo (✅) ou pas (🚫)</strong>, avec un
              lien vers sa candidature. Ils sont <strong className="text-text">classés par dispo</strong> (le plus de
              jours dispo d&apos;abord) et une ligne de dates <UI>✅ 22/10</UI>… ne garde que ceux dispo ce jour-là. Coche-les pour <UI>📋 Envoyer en booking</UI> (fonction et cachet obligatoires,
              ils quittent la réserve) ou <UI>↩ Retirer de la réserve</UI> (une candidature retirée revient dans
              Candidatures).
            </>,
            <>
              Renseigne <strong className="text-text">fonction</strong>,{" "}
              <strong className="text-text">cachet</strong> et <strong className="text-text">statut</strong>{" "}
              pour chaque profil (dont <UI>Proposé MES</UI>, <UI>Attente réponse booking</UI> en orange foncé,{" "}
              <UI>À rappeler</UI> en bleu foncé et <UI>À annuler</UI> en rouge pâle). Un profil venu d&apos;une annonce
              du projet a un lien <UI>📄 Candidature</UI> (et <UI>📄 Voir sa candidature</UI> sur sa fiche booking) pour
              revoir ce qu&apos;il avait envoyé : message, photos, réponses aux questions. Dans <strong className="text-text">Besoins de la journée</strong>, ajoute les
              fonctions attendues avec leur quantité ; le <UI>✎</UI> d&apos;une fonction permet d&apos;en changer le
              nom ou la quantité (les profils qui l&apos;ont sont renommés avec). Toute fonction saisie (booking,
              besoins, candidature) est <strong className="text-text">enregistrée pour le projet</strong> et
              proposée ensuite dans les déroulants, par ordre alphabétique. Sur chaque profil, le déroulant{" "}
              <UI>Fonction</UI> propose d&apos;abord les <strong className="text-text">besoins de la journée</strong>, puis
              les autres fonctions du projet, ou <UI>➕ Nouvelle fonction…</UI> — une même fonction tapée autrement
              (« passant », « PASSANT ») reprend l&apos;orthographe enregistrée. <UI>⚙️ Fonctions du projet</UI>{" "}
              permet de retirer une faute de frappe de la liste. Chaque carte a aussi une case{" "}
              <strong className="text-text">Notes</strong> (spécificités, retours…), enregistrée en quittant le champ.
            </>,
            <>
              Sur chaque carte, coche <UI>Répondu booking</UI> quand la personne accepte la proposition : elle
              passe en <strong className="text-text">CONFIRMÉ</strong>. Envoie ensuite les convocations
              (individuellement ou en masse) ; <UI>Répondu convocation</UI> se coche quand elle répond BIEN REÇU.{" "}
              <UI>Vérifier les réponses</UI> liste les réponses mail des seules personnes bookées dans la journée
              affichée ; <UI>Effacer la liste</UI> n&apos;efface que celles-là.
            </>,
            <>
              Pour <strong className="text-text">changer de date</strong>, coche le ou les profils puis{" "}
              <UI>🔀 Changer de date</UI> : choisis une autre journée du projet ou une nouvelle date. La convocation
              et le « bien reçu » repartent à zéro, et par défaut le statut repasse en PER pour que la personne
              reconfirme. <UI>📅 Ajouter des dates</UI>, lui, garde la date actuelle et en ajoute d&apos;autres.
            </>,
            <>
              Pour <strong className="text-text">enlever quelqu&apos;un de la journée</strong>, coche-le·la puis{" "}
              <UI>🗑 Retirer de la journée</UI> (après confirmation, sans message envoyé). Pour garder une trace,
              passe plutôt son statut en <strong className="text-text">Annulé</strong> : il·elle sort de la liste
              et des documents, mais reste consultable via <UI>Afficher</UI> (« indisponibles/annulés masqués »).
            </>,
            "Depuis la journée, tu accèdes aussi au covoiturage, aux essayages liés et aux documents à générer.",
          ]}
        />
        <Callout>
          <strong className="text-text">Une journée qui ressemble à une autre ?</strong>{" "}
          <UI>📋 Dupliquer la journée</UI> la recopie à une autre date : lieu, message de convocation, besoins, et au
          choix les profils calés (passés en PER pour reconfirmer, ou avec leur statut actuel). Les annulé·es ne sont
          pas repris et personne n&apos;est doublé.
        </Callout>
        <Callout>
          <strong className="text-text">Le plan de travail change ?</strong> Sur la journée concernée,{" "}
          <UI>🔀 Nouvelle journée PDT</UI> puis choisis la nouvelle date : un aperçu montre combien de profils vont
          basculer, qui a déclaré une indispo ce jour-là, et qui y est déjà calé·e (non touché·e). Tout le monde
          réapparaît sur la nouvelle journée en <strong className="text-text">À REBOOKER</strong> — les autres
          journées ne bougent pas. Coche <UI>Prévenir les profils</UI> pour leur envoyer le message (modifiable,
          gardé pour le projet ; e-mail en option), ou décoche-la pour un simple déplacement silencieux. Dès que tu
          changes le statut de quelqu&apos;un sur la nouvelle journée (CONFIRMÉ, Indisponible…), il·elle disparaît
          de l&apos;ancienne ; quand tout le monde est traité, le bandeau de l&apos;ancienne journée propose{" "}
          <UI>Supprimer cette journée</UI>.
        </Callout>
        <Callout>
          <strong className="text-text">Onglet Covoiturage.</strong> Glisse un profil sur un·e chauffeur·euse
          pour l&apos;ajouter comme passager·ère, ou classe-le·la en <strong className="text-text">PPM</strong>{" "}
          (par ses propres moyens — indemnité individuelle) ou <strong className="text-text">Transport en
          commun</strong>. Les profils restants (« Sans covoiturage ») sont groupés par code postal et triés par
          nom de famille, pour repérer qui habite dans le même coin. Coche plusieurs profils (case en haut à
          gauche de chaque photo) pour les glisser tous en même temps, et utilise les icônes 📞 💬 ✉️ pour
          joindre directement qui que ce soit. <UI>Appliquer à un autre jour</UI> recopie toute
          l&apos;organisation vers une autre journée du même projet, pour les profils raccord (booké·es les
          deux jours).
        </Callout>
        <Callout>
          <strong className="text-text">Onglet Messages.</strong> À gauche, tous les profils de la journée en{" "}
          <UI>🖼️ Trombi</UI> ou <UI>☰ Liste</UI> : statut modifiable directement, pastilles (Proposition,
          Convoc, chaque message d&apos;info), filtres (proposition sans réponse, convocation sans BIEN REÇU,
          sans nouvelles, ont répondu). Un tap sur une carte la coche. À droite, le panneau{" "}
          <strong className="text-text">Envois de la journée</strong> avec deux sections séparées{" "}
          <UI>✉️ Mail</UI> et <UI>📱 Texto</UI> : on écrit un message nommé (Parking, Horaire avancé…) pour les
          profils cochés, on confirme dans le panneau, puis on suit qui l&apos;a bien reçu (lien{" "}
          <UI>👍 Bien reçu</UI> en un clic), qui a répondu (réponse citée sous son nom) et qui est sans
          nouvelles, avec <UI>🔁 Relancer</UI> et <UI>Marquer reçu</UI>. Les réponses par mail sont relevées
          toutes seules dans la boîte d&apos;envoi du projet (sans les marquer lues dans Gmail) ; une fois
          traitée, <UI>✓ Marquer comme lu dans Gmail</UI> la passe en lu dans la boîte. Les réponses par texto
          remontent aussi toutes seules si le relais Mac est installé et autorisé à lire Messages (Mon compte →
          Textos) ; sinon, à marquer à la main. <UI>Ouvrir ses messages</UI> / <UI>💬 Lire sa réponse</UI> ouvre la fiche du profil : statut,{" "}
          <UI>Répondu booking</UI> (passe en CONFIRMÉ), <UI>Répondu convocation</UI> (carte en jaune), chaque
          message d&apos;info, et toute la conversation, avec une réponse rapide par mail ou par texto. Sur iPad
          debout et téléphone, le bouton <UI>✉️ Envois</UI> en bas à droite ouvre le panneau.
        </Callout>
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
            {
              title: "Trombi covoiturage",
              body: "Un groupe par conducteur·rice avec ses passagers, un groupe PPM, un groupe Transport en commun, puis le reste trié par code postal croissant (masquable). Bascule Trombi/Liste pour une version texte sans photos.",
            },
            { title: "Liste d'appel, bordereau, vCards", body: "Depuis Bookings → Documents, un onglet par type de document." },
          ]}
        />
        <p className="text-sm text-text-muted">
          Sur chaque document, <UI>Champs à afficher</UI> te permet de cocher ce que tu veux montrer (téléphone,
          email, âge, ville...), puis <UI>Télécharger le PDF</UI> ou <UI>Imprimer</UI>.
        </p>
        <p className="text-sm text-text-muted">
          Photos des trombis et fiches : dans la journée, <UI>📷 Photos</UI> à côté d&apos;un nom permet de choisir
          jusqu&apos;à 3 photos dans l&apos;ordre (la 1 est la photo principale du trombi). Sans choix : photos de
          l&apos;essayage sur le projet, sinon les 3 premières de la candidature (portrait d&apos;abord), sinon celles
          du compte. Un nouvel essayage reprend la main sur un choix fait avant lui.
        </p>
        <p className="text-sm text-text-muted">
          Trombis et fiches mensuration : la ligne <UI>Qui</UI> choisit qui sortir. Par défaut les{" "}
          <UI>Confirmé·es</UI> ; aussi <UI>Proposé·es</UI>, <UI>PER</UI> ou <UI>Tout le monde</UI> (sauf annulé·es
          et indisponibles).
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
            <>
              Une fois le lien créé, <UI>Aperçu</UI> l&apos;ouvre tel quel dans un nouvel onglet — pour
              vérifier exactement ce que costume, HMC ou régie verront avant de leur envoyer (sans compter de visite).
            </>,
            <>
              <strong className="text-text">Qui a vu, qui est en ligne, commentaires</strong> : à l&apos;ouverture
              d&apos;un lien (réal du casting, documents, essayages, journée, validation MES), la personne donne son prénom
              et son rôle, une seule fois sur son appareil (sur le lien réal du casting, seulement au moment
              d&apos;écrire un commentaire). Tout est traduit avec le bouton FR/EN, lien de validation MES compris. Sous chaque lien, tu vois qui l&apos;a ouvert, qui est en
              ligne (point vert), et le fil de commentaires laissés avec le bouton <UI>💬 Commentaires</UI>, auquel tu peux
              répondre. Chaque commentaire arrive aussi dans la cloche (filtre « Liens partagés »).
            </>,
          ]}
        />
      </GuideChapter>

      <GuideChapter
        id="messagerie"
        icon={MessageCircle}
        title="Messagerie"
        audiences={["tous"]}
        intro="Chaque fiche figurant·e a son propre fil de discussion, visible uniquement par les chef·fes concerné·es par ses projets en cours."
      >
        <Steps
          items={[
            <>
              Écris un message depuis la fiche en choisissant une{" "}
              <strong className="text-text">catégorie</strong> (Booking, Convocations, Covoiturage, Essayage, HMC,
              Casting, Libre, Espace perso), ou utilise un <strong className="text-text">modèle</strong> pré-rempli.
            </>,
            <>Coche <strong className="text-text">Notifier par email</strong> pour que le message parte aussi par mail.</>,
            <>
              Côté figurant·e, l&apos;espace ne sert qu&apos;à consulter et cocher <UI>BIEN REÇU</UI> — pour
              répondre, c&apos;est par email, pas depuis l&apos;appli.
            </>,
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
              "Il·elle reçoit une invitation par email pour créer son compte — son accès reste limité aux projets où iel est invité·e.",
              <>
                Dans la colonne <UI>Sections</UI> de sa ligne, coche les sections précises auxquelles il·elle a
                droit (Bookings, Casting...) plutôt que tout l&apos;outil — sans rien cocher, l&apos;accès reste
                complet.
              </>,
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
              <>
                Clique <UI>Tester la boîte d&apos;envoi</UI> : si Gmail refuse (mot de passe faux ou révoqué, par
                exemple après un changement du mot de passe Google), le message l&apos;indique — recrée alors un mot
                de passe d&apos;application. Le même bouton existe dans les réglages d&apos;un projet qui a sa propre
                boîte.
              </>,
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Textos en masse (depuis ton numéro)</p>
          <Steps
            items={[
              <>
                Dans <UI>Mon compte</UI> (chaque membre, assistant·es compris), section <UI>📱 Textos en masse</UI> : installe le{" "}
                <strong className="text-text">raccourci iPhone</strong> (un fichier à ajouter dans l&apos;app
                Raccourcis) et/ou le <strong className="text-text">relais Mac</strong> (une commande à coller dans le
                Terminal du Mac). Le bouton « Texto d&apos;essai à mon numéro » vérifie que tout marche.
              </>,
              <>
                Ensuite, dans un message de journée (convocation, message libre) ou de casting :{" "}
                <UI>📱 En textos</UI> → <UI>Depuis mon iPhone</UI> (site ouvert sur l&apos;iPhone) ou{" "}
                <UI>Depuis mon Mac</UI> (le Mac allumé les envoie un par un, toutes les 8 à 15 secondes, avec Messages).
                Avec l&apos;<UI>Accès complet au disque</UI> (voir ci-dessous), chaque texto part d&apos;abord en{" "}
                <strong className="text-text">iMessage</strong> (directement du Mac, instantané pour les iPhone), puis
                en <strong className="text-text">SMS</strong> par ton iPhone si la personne n&apos;a pas iMessage. Le relais
                s&apos;en souvient (historique de Messages) : un numéro sans iMessage reçoit directement un SMS les fois
                suivantes, une seule bulle « Non distribué » de ton côté la première fois (la personne, elle, ne reçoit
                que le SMS). Un SMS{" "}
                « Non distribué » est renvoyé une fois tout seul. Un échec, ou un SMS bloqué « en cours » plus de 3 min
                (Transfert de SMS de l&apos;iPhone à vérifier), compte dans les échecs de Mon compte → Textos.
                Chaque texto est personnalisé ; les réponses arrivent dans ta messagerie habituelle. La fenêtre
                reprend toujours ton <strong className="text-text">dernier message envoyé</strong> (journée, rôle de
                casting, candidatures), sur tous tes appareils : plus besoin de le retaper.
              </>,
              <>
                <strong className="text-text">Réponses texto sur le site.</strong> Le relais Mac peut aussi remonter
                les réponses reçues dans Messages (onglet Messages de la journée, fiche du profil). Une seule fois :
                Réglages Système → Confidentialité et sécurité → <UI>Accès complet au disque</UI> → + → Cmd+Maj+G →{" "}
                <code>/bin/bash</code>, et l&apos;activer. Seules les réponses à un texto envoyé depuis l&apos;appli
                (ces 30 derniers jours) sont remontées, et seulement celles reçues après cet envoi : un échange perso avec
                quelqu&apos;un de booké, ou avec un membre de l&apos;équipe, ne remonte jamais. L&apos;état s&apos;affiche
                dans Mon compte → Textos.
              </>,
            ]}
          />
        </div>
        <Callout tone="yellow">
          <strong className="text-text">Obligatoire si tu n&apos;es pas le compte principal.</strong> Sans
          boîte configurée, l&apos;envoi de tout message (convocations, casting, espace perso...) est bloqué —
          c&apos;est voulu, pour qu&apos;aucun message ne parte jamais depuis l&apos;adresse d&apos;un·e autre
          chef·fe.
        </Callout>
        <Callout>
          <strong className="text-text">Mails automatiques.</strong> Toujours dans Équipe, section{" "}
          <UI>Mails automatiques</UI> : calibre le texte d&apos;activation de l&apos;espace perso et de renvoi du
          lien de connexion, ou laisse vide pour garder le texte par défaut.
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
            { title: "Modèles", body: "Enregistre des messages type (convocation, relance...) réutilisables partout où tu envoies un message. Ils restent propres à ton équipe : les autres cheffes ne les voient pas. Les modèles ⭐ prêts à l'emploi (proposition, convocation, relance, casting…) sont communs à tout le monde : copie-les dans tes modèles pour les personnaliser." },
            { title: "Barème", body: "Référence des cachets et majorations ACFDA appliqués automatiquement selon la convention du projet." },
            { title: "RGPD", body: "Outils d'anonymisation pour les profils qui demandent la suppression de leurs données." },
          ]}
        />
      </GuideChapter>

      <p className="text-center text-xs text-text-muted">
        Une question, un écran qui ne correspond plus à ce guide ?{" "}
        <Link href="/equipe" className="text-coral hover:underline">
          Préviens ton·ta chef·fe de casting
        </Link>{" "}
        — ce guide est mis à jour à chaque nouvelle fonctionnalité livrée.
      </p>
    </div>
  );
}
