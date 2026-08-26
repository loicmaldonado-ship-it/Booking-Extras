import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { CopyLink } from "@/components/annonces/copy-link";
import { CopyAnnonceText } from "@/components/annonces/copy-annonce-text";
import { ToggleStatutButton } from "@/components/annonces/toggle-statut-button";
import { QuestionsManager } from "@/components/annonces/questions-manager";
import { DatesManager } from "@/components/annonces/dates-manager";
import { MoodboardPanel } from "@/components/annonces/moodboard-panel";
import { getAnnoncePhotos } from "@/lib/annonces/moodboard";
import { generateQrCodeDataUrl } from "@/lib/annonces/qrcode";
import { BackLink } from "@/components/ui/back-link";
import type { AnnonceAvecProjet } from "@/lib/annonces/types";
import { deleteAnnonce } from "@/lib/annonces/actions";
import { getAnnonceQuestions, getQuestionTemplates } from "@/lib/annonces/questions";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import { requireProjetAccess } from "@/lib/auth/session";

export default async function AnnonceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: annonce } = await supabase
    .from("annonces")
    .select("*, projets(nom, confidentiel, nom_code)")
    .eq("id", id)
    .single<AnnonceAvecProjet>();

  if (!annonce) notFound();
  await requireProjetAccess(annonce.projet_id);

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const publicUrl = `${protocol}://${host}/postuler/${annonce.public_token}`;

  const { count: candidatureCount } = await supabase
    .from("candidatures")
    .select("id", { count: "exact", head: true })
    .eq("annonce_id", id);

  const [questions, templates, dates, moodboardPhotos, qrCodeDataUrl] = await Promise.all([
    getAnnonceQuestions(id),
    getQuestionTemplates(),
    getAnnonceDates(id),
    getAnnoncePhotos(supabase, id),
    generateQrCodeDataUrl(publicUrl),
  ]);

  const boundDeleteAnnonce = deleteAnnonce.bind(null, id);

  const shareLines = [
    annonce.titre,
    [projetNomPublic(annonce.projets), annonce.lieu, annonce.date_recherchee ? formatDateShort(annonce.date_recherchee) : null]
      .filter(Boolean)
      .join(" · "),
  ];
  if (annonce.description) shareLines.push("", annonce.description);
  shareLines.push("", `Merci de suivre ce lien pour postuler : ${publicUrl}`);
  const shareText = shareLines.join("\n");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/annonces" label="Annonces" />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold">{annonce.titre}</h1>
            <Badge tone={annonce.statut === "ouverte" ? "turquoise" : "default"}>
              {annonce.statut === "ouverte" ? "Ouverte" : "Fermée"}
            </Badge>
          </div>
          <p className="mt-1 text-text-muted">
            {annonce.projets?.nom}
            {annonce.date_recherchee ? ` · ${formatDateShort(annonce.date_recherchee)}` : ""}
            {annonce.lieu ? ` · ${annonce.lieu}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href={`/candidatures?annonce_id=${id}`}>Voir les candidatures</ButtonLink>
          <ButtonLink href={`/annonces/${id}/modifier`} variant="secondary">
            Modifier
          </ButtonLink>
          <form action={boundDeleteAnnonce}>
            <Button type="submit" variant="ghost">
              Supprimer
            </Button>
          </form>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Lien public à diffuser</h2>
        <CopyLink url={publicUrl} />
        <CopyAnnonceText text={shareText} />
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL générée côté serveur, pas une image optimisable */}
          <img src={qrCodeDataUrl} alt="QR code vers l'annonce" width={96} height={96} className="rounded-lg" />
          <div className="flex flex-col gap-2">
            <a
              href={qrCodeDataUrl}
              download={`qr-${id}.png`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-muted hover:border-coral/60 hover:text-text"
            >
              Télécharger le QR code
            </a>
            <a
              href={`/annonces/${id}/poster`}
              download={`affiche-${id}.png`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-muted hover:border-coral/60 hover:text-text"
            >
              Télécharger l&apos;affiche (Insta/Facebook)
            </a>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Link href={`/candidatures?annonce_id=${id}`} className="text-coral hover:underline">
              {candidatureCount ?? 0}
              {annonce.limite_candidatures !== null ? `/${annonce.limite_candidatures}` : ""} candidature
              {(candidatureCount ?? 0) > 1 ? "s" : ""} reçue{(candidatureCount ?? 0) > 1 ? "s" : ""} →
            </Link>
            {annonce.limite_candidatures !== null && (candidatureCount ?? 0) >= annonce.limite_candidatures && (
              <Badge tone="danger">Complet</Badge>
            )}
          </p>
          <ToggleStatutButton id={id} statut={annonce.statut} />
        </div>
      </Card>

      {annonce.description && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-sm whitespace-pre-wrap">{annonce.description}</p>
        </Card>
      )}

      <MoodboardPanel annonceId={id} photos={moodboardPhotos} />

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Questions (Oui/Non)</h2>
          <p className="text-sm text-text-muted">
            Posées aux candidats sur le formulaire public, en plus du message obligatoire.
          </p>
        </div>
        <QuestionsManager annonceId={id} questions={questions} templates={templates} />
      </Card>

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Dates de disponibilité à demander</h2>
          <p className="text-sm text-text-muted">
            Chaque candidat·e indiquera s&apos;il·elle est disponible ou non pour chacune de ces dates.
          </p>
        </div>
        <DatesManager annonceId={id} dates={dates} />
      </Card>

      <Link href={`/projets/${annonce.projet_id}`} className="text-sm text-text-muted hover:text-coral">
        Voir le projet →
      </Link>
    </div>
  );
}
