import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Une URL signée Supabase change de jeton à chaque appel, même pour un
// chemin identique — sans cache, chaque vue de page régénère un jeton
// différent pour les mêmes photos/vidéos. Comme le jeton fait partie de
// l'URL, ça change le `src` passé à next/image (et l'URL vidéo) à chaque
// fois : ni le cache de l'optimiseur d'images Next.js, ni le cache du
// navigateur ne peuvent jamais faire un "hit", et tout se retélécharge
// depuis Supabase à chaque vue de page — gros contributeur d'egress.
// Mis en cache un peu en dessous de la validité réelle du jeton (1h) pour
// que les vues répétées réutilisent la même URL.
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_SECONDS = 45 * 60;

export const getCachedSignedUrls = unstable_cache(
  async (bucket: string, paths: string[]): Promise<{ path: string; signedUrl: string | null }[]> => {
    if (paths.length === 0) return [];
    const supabase = createAdminClient();
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    return (data ?? []).map((d) => ({ path: d.path ?? "", signedUrl: d.signedUrl ?? null }));
  },
  ["signed-urls-batch"],
  { revalidate: SIGNED_URL_CACHE_SECONDS }
);

export const getCachedSignedUrl = unstable_cache(
  async (bucket: string, path: string): Promise<string | null> => {
    const supabase = createAdminClient();
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    return data?.signedUrl ?? null;
  },
  ["signed-url-single"],
  { revalidate: SIGNED_URL_CACHE_SECONDS }
);
