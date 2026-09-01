import { resolvePartageToken, getPartageTitreByToken } from "@/lib/partage/data";
import { getCastingRoles, getCastingEntries, getCastingVideoUrls, getCastingEntryPhotos } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { Card, Badge } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { CastingRealEntryCard } from "@/components/casting/casting-real-entry-card";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, parseLang } from "@/lib/i18n/partage";
import { formatDateLong } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";

export default async function PartageCastingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const lang = parseLang((await searchParams).lang);
  const projet = await resolvePartageToken(token, "casting");

  if (!projet) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t(lang, "lien_introuvable")}</h1>
        <p className="text-text-muted">{t(lang, "lien_invalide")}</p>
      </div>
    );
  }

  const [roles, entries, titre] = await Promise.all([
    getCastingRoles(projet.id),
    getCastingEntries(projet.id),
    getPartageTitreByToken(token, "casting"),
  ]);
  // Le staff décide seul de la visibilité — dès qu'un profil ou un rôle est
  // coché visible, il apparaît, même sans vidéo envoyée ou sans aucun
  // profil dedans pour l'instant (pas de condition automatique en plus du
  // choix du staff).
  const visibleEntries = entries.filter((e) => e.visible_partage);

  const entriesByRole = new Map<string, typeof visibleEntries>();
  for (const e of visibleEntries) {
    const list = entriesByRole.get(e.role_id) ?? [];
    list.push(e);
    entriesByRole.set(e.role_id, list);
  }
  const rolesAvecProfils = roles.filter((r) => r.visible_partage);

  const entryIds = visibleEntries.map((e) => e.id);
  const figurantIds = visibleEntries.map((e) => e.figurant_id);
  const [photosByFigurant, videoUrlsList, entryPhotosByEntry] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    Promise.all(visibleEntries.map((e) => getCastingVideoUrls(e.video_storage_paths))),
    getCastingEntryPhotos(entryIds),
  ]);
  const videoUrlsByEntry = new Map(visibleEntries.map((e, i) => [e.id, videoUrlsList[i]]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Logo iconSize={26} textClassName="text-lg" />
          <LangToggle lang={lang} basePath={`/partage/casting/${token}`} />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">{titre || `Casting — ${projetNomPublic(projet)}`}</h1>
        <p className="mt-1 text-sm text-text-muted">{t(lang, "clique_profil")}</p>
      </div>

      {rolesAvecProfils.map((role) => {
        const roleEntries = entriesByRole.get(role.id) ?? [];
        return (
          <Card key={role.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{role.nom}</h2>
              {role.date_tournage && <Badge>{formatDateLong(role.date_tournage)}</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {roleEntries.map((entry) => (
                <CastingRealEntryCard
                  key={entry.id}
                  nom={`${entry.figurants?.prenom ?? ""} ${entry.figurants?.nom ?? ""}`.trim()}
                  portraitUrl={pickPortrait(photosByFigurant.get(entry.figurant_id), projet.id)?.url ?? null}
                  videoUrls={videoUrlsByEntry.get(entry.id) ?? []}
                  photos={entryPhotosByEntry.get(entry.id) ?? []}
                  lang={lang}
                />
              ))}
              {roleEntries.length === 0 && (
                <p className="col-span-full text-sm text-text-muted">{t(lang, "aucun_profil_disponible")}</p>
              )}
            </div>
          </Card>
        );
      })}

      {rolesAvecProfils.length === 0 && <p className="text-text-muted">{t(lang, "aucun_profil_disponible")}</p>}
    </div>
  );
}
