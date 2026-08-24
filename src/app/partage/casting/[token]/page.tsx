import Image from "next/image";
import { resolvePartageToken } from "@/lib/partage/data";
import { getCastingRoles, getCastingEntries, getCastingVideoUrls } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { Card, Badge } from "@/components/ui/card";
import { formatDateLong } from "@/lib/format-date";
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

  const [roles, entries] = await Promise.all([getCastingRoles(projet.id), getCastingEntries(projet.id)]);
  const submitted = entries.filter((e) => e.submitted_at);

  const submittedByRole = new Map<string, typeof submitted>();
  for (const e of submitted) {
    const list = submittedByRole.get(e.role_id) ?? [];
    list.push(e);
    submittedByRole.set(e.role_id, list);
  }
  const rolesAvecProfils = roles.filter((r) => (submittedByRole.get(r.id) ?? []).length > 0);

  const figurantIds = submitted.map((e) => e.figurant_id);
  const [photosByFigurant, videoUrlsList] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    Promise.all(submitted.map((e) => getCastingVideoUrls(e.video_storage_paths))),
  ]);
  const videoUrlsByEntry = new Map(submitted.map((e, i) => [e.id, videoUrlsList[i]]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Casting — {projetNomPublic(projet)}</h1>
      </div>

      {rolesAvecProfils.map((role) => {
        const roleEntries = submittedByRole.get(role.id) ?? [];
        const avecVideo = role.nb_videos > 0;
        return (
          <Card key={role.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{role.nom}</h2>
              {role.date_tournage && <Badge>{formatDateLong(role.date_tournage)}</Badge>}
            </div>

            {avecVideo ? (
              <div className="flex flex-col gap-4">
                {roleEntries.map((entry) => {
                  const portraitUrl = pickPortrait(photosByFigurant.get(entry.figurant_id), projet.id)?.url ?? null;
                  const videoUrls = videoUrlsByEntry.get(entry.id) ?? [];
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 rounded-xl border border-border bg-ink px-4 py-3"
                    >
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
                        {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />}
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <span className="font-medium">
                          {entry.figurants?.prenom} {entry.figurants?.nom}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {videoUrls.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-coral px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
                          >
                            Vidéo{videoUrls.length > 1 ? ` ${i + 1}` : ""} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
                {roleEntries.map((entry) => {
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
            )}
          </Card>
        );
      })}

      {rolesAvecProfils.length === 0 && <p className="text-text-muted">Aucun profil disponible pour l&apos;instant.</p>}
    </div>
  );
}
