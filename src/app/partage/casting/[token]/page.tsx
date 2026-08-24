import Image from "next/image";
import { resolvePartageToken } from "@/lib/partage/data";
import { getCastingEntries, getCastingVideoUrl } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { Card, Badge } from "@/components/ui/card";
import { projetNomPublic } from "@/lib/projets/types";

export default async function PartageCastingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const projet = await resolvePartageToken(token, "casting");

  if (!projet) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Lien introuvable</h1>
        <p className="text-text-muted">Ce lien de partage n&apos;est plus valide.</p>
      </div>
    );
  }

  const entries = await getCastingEntries(projet.id);
  const submitted = entries.filter((e) => e.submitted_at);
  const roles = submitted.filter((e) => !e.silhouette);
  const figurants = submitted.filter((e) => e.silhouette);

  const figurantIds = submitted.map((e) => e.figurant_id);
  const [photosByFigurant, videoUrls] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    Promise.all(roles.map((e) => getCastingVideoUrl(e.video_storage_path))),
  ]);
  const videoUrlByEntry = new Map(roles.map((e, i) => [e.id, videoUrls[i]]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Casting — {projetNomPublic(projet)}</h1>
      </div>

      {roles.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Rôles</h2>
          <div className="flex flex-col gap-4">
            {roles.map((entry) => {
              const portraitUrl = pickPortrait(photosByFigurant.get(entry.figurant_id), projet.id)?.url ?? null;
              const videoUrl = videoUrlByEntry.get(entry.id);
              return (
                <div key={entry.id} className="flex items-center gap-4 rounded-xl border border-border bg-ink px-4 py-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
                    {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-medium">
                      {entry.figurants?.prenom} {entry.figurants?.nom}
                    </span>
                    {entry.role_label && <Badge>{entry.role_label}</Badge>}
                  </div>
                  {videoUrl && (
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
                    >
                      Voir la vidéo ↗
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {figurants.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Figurants</h2>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {figurants.map((entry) => {
              const portraitUrl = pickPortrait(photosByFigurant.get(entry.figurant_id), projet.id)?.url ?? null;
              return (
                <div key={entry.id} className="flex flex-col items-center gap-1 text-center">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
                    {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />}
                  </div>
                  <span className="text-xs font-medium">
                    {entry.figurants?.prenom} {entry.figurants?.nom}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {submitted.length === 0 && <p className="text-text-muted">Aucun profil disponible pour l&apos;instant.</p>}
    </div>
  );
}
