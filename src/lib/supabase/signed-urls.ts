import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Une URL signée Supabase change de jeton à chaque appel, même pour un
// chemin identique — sans cache, chaque vue de page régénère un jeton
// différent pour les mêmes photos/vidéos. Comme le jeton fait partie de
// l'URL, ça change le `src` passé à next/image (et l'URL vidéo) à chaque
// fois : ni le cache de l'optimiseur d'images Next.js, ni le cache du
// navigateur ne peuvent jamais faire un "hit", et tout se retélécharge
// depuis Supabase à chaque vue de page — gros contributeur d'egress.
//
// Le cache est découpé en fenêtres de 6 h (la fenêtre fait partie de la
// clé) et les jetons valent 13 h. Avant (cache 45 min / jeton 1 h, en
// « stale-while-revalidate »), la première vue après plus d'une heure sans
// visite recevait encore les anciennes URL, déjà expirées : photos
// cassées (« ? »), qui revenaient au rafraîchissement suivant. Désormais,
// une URL servie a toujours au moins 7 h de validité devant elle.
const FENETRE_SECONDS = 6 * 60 * 60;
const SIGNED_URL_TTL_SECONDS = 13 * 60 * 60;

function fenetreCourante() {
  return Math.floor(Date.now() / 1000 / FENETRE_SECONDS);
}

const signerLot = unstable_cache(
  async (bucket: string, paths: string[], fenetre: number): Promise<{ path: string; signedUrl: string | null }[]> => {
    void fenetre; // sert seulement de clé de cache
    if (paths.length === 0) return [];
    const supabase = createAdminClient();
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    return (data ?? []).map((d) => ({ path: d.path ?? "", signedUrl: d.signedUrl ?? null }));
  },
  ["signed-urls-batch-fenetre"],
  { revalidate: false }
);

const signerUn = unstable_cache(
  async (bucket: string, path: string, fenetre: number): Promise<string | null> => {
    void fenetre; // sert seulement de clé de cache
    const supabase = createAdminClient();
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  },
  ["signed-url-single-fenetre"],
  { revalidate: false }
);

export function getCachedSignedUrls(bucket: string, paths: string[]) {
  return signerLot(bucket, paths, fenetreCourante());
}

export function getCachedSignedUrl(bucket: string, path: string) {
  return signerUn(bucket, path, fenetreCourante());
}
