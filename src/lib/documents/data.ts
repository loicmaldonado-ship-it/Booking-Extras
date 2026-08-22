import { createAdminClient } from "@/lib/supabase/admin";
import type { Figurant, FigurantPhoto } from "@/lib/figurants/types";

export type FigurantPhotoWithUrl = Omit<FigurantPhoto, "url"> & { url: string | null };

export type ConfirmedBooking = {
  id: string;
  heure_convocation: string | null;
  fonction: string | null;
  cachet: string | null;
  figurant: Figurant;
};

export async function getConfirmedBookings(
  projetId: string,
  date: string
): Promise<ConfirmedBooking[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("bookings")
    .select("id, heure_convocation, fonction, cachet, figurants!bookings_figurant_id_fkey(*)")
    .eq("projet_id", projetId)
    .eq("date", date)
    .eq("statut", "confirmé")
    .returns<
      { id: string; heure_convocation: string | null; fonction: string | null; cachet: string | null; figurants: Figurant | null }[]
    >();

  return (data ?? [])
    .filter((b): b is typeof b & { figurants: Figurant } => !!b.figurants)
    .map((b) => ({
      id: b.id,
      heure_convocation: b.heure_convocation,
      fonction: b.fonction,
      cachet: b.cachet,
      figurant: b.figurants,
    }))
    .sort((a, b) => (a.heure_convocation ?? "").localeCompare(b.heure_convocation ?? ""));
}

export async function getPhotosByFigurantId(figurantIds: string[]) {
  const supabase = createAdminClient();
  if (figurantIds.length === 0) return new Map<string, FigurantPhotoWithUrl[]>();

  const { data: photos } = await supabase
    .from("figurant_photos")
    .select("*")
    .in("figurant_id", figurantIds)
    .returns<FigurantPhoto[]>();

  const withUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("figurant-photos")
        .createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, url: data?.signedUrl ?? null };
    })
  );

  const map = new Map<string, FigurantPhotoWithUrl[]>();
  for (const photo of withUrls) {
    const list = map.get(photo.figurant_id) ?? [];
    list.push(photo);
    map.set(photo.figurant_id, list);
  }
  return map;
}

export type FutureBooking = { id: string; date: string; projetNom: string };

export async function getFutureBookingsByFigurant(figurantIds: string[], fromDate: string) {
  const supabase = createAdminClient();
  if (figurantIds.length === 0) return new Map<string, FutureBooking[]>();

  const { data } = await supabase
    .from("bookings")
    .select("id, figurant_id, date, projets(nom)")
    .in("figurant_id", figurantIds)
    .gte("date", fromDate)
    .neq("statut", "annulé")
    .order("date", { ascending: true })
    .returns<{ id: string; figurant_id: string; date: string; projets: { nom: string } | null }[]>();

  const map = new Map<string, FutureBooking[]>();
  for (const b of data ?? []) {
    const list = map.get(b.figurant_id) ?? [];
    list.push({ id: b.id, date: b.date, projetNom: b.projets?.nom ?? "" });
    map.set(b.figurant_id, list);
  }
  return map;
}

// Sur les documents d'un projet précis (trombis, fiches, bordereaux...), la
// photo en tenue prise pendant l'essayage de CE projet remplace le portrait
// générique — le portrait reste utilisé partout ailleurs (Base Profils,
// autres projets).
export function pickPortrait(photos: FigurantPhotoWithUrl[] | undefined, projetId?: string) {
  if (!photos) return null;
  if (projetId) {
    const tenue = photos.find((p) => p.type === "tenue" && p.projet_id === projetId);
    if (tenue) return tenue;
  }
  return photos.find((p) => p.type === "portrait") ?? null;
}

// Cachet et fonction ne vivent que sur les bookings, pas sur les essayages
// — pour les documents essayage (planning partagé, fiches), on reprend
// ceux du booking le plus récent de la personne sur ce projet qui les
// renseigne réellement (un booking plus récent mais pas encore rempli ne
// doit pas masquer le cachet/fonction d'un booking antérieur).
export async function getCachetFonctionByFigurant(projetId: string, figurantIds: string[]) {
  const supabase = createAdminClient();
  const map = new Map<string, { cachet: string | null; fonction: string | null }>();
  if (figurantIds.length === 0) return map;

  const { data } = await supabase
    .from("bookings")
    .select("figurant_id, cachet, fonction, date")
    .eq("projet_id", projetId)
    .in("figurant_id", figurantIds)
    .order("date", { ascending: false });

  for (const b of data ?? []) {
    const existing = map.get(b.figurant_id);
    const hasData = b.cachet !== null || b.fonction !== null;
    if (!existing || (hasData && existing.cachet === null && existing.fonction === null)) {
      map.set(b.figurant_id, { cachet: b.cachet, fonction: b.fonction });
    }
  }
  return map;
}

// Dates de tournage d'une personne sur CE projet précis (contrairement à
// getFutureBookingsByFigurant, pas de fuite vers d'autres projets — utile
// pour les liens de partage scopés à un seul projet).
export async function getProjetBookingDatesByFigurant(projetId: string, figurantIds: string[]) {
  const supabase = createAdminClient();
  const map = new Map<string, FutureBooking[]>();
  if (figurantIds.length === 0) return map;

  const { data } = await supabase
    .from("bookings")
    .select("id, figurant_id, date, projets(nom)")
    .eq("projet_id", projetId)
    .in("figurant_id", figurantIds)
    .neq("statut", "annulé")
    .order("date", { ascending: true })
    .returns<{ id: string; figurant_id: string; date: string; projets: { nom: string } | null }[]>();

  for (const b of data ?? []) {
    const list = map.get(b.figurant_id) ?? [];
    list.push({ id: b.id, date: b.date, projetNom: b.projets?.nom ?? "" });
    map.set(b.figurant_id, list);
  }
  return map;
}

export function pickFichePhotos(photos: FigurantPhotoWithUrl[] | undefined, projetId?: string) {
  if (!photos) return [];
  // Les photos "en tenue" d'un autre projet ne concernent pas ce document.
  const relevant = photos.filter((p) => p.type !== "tenue" || p.projet_id === projetId);
  const tenue = projetId ? relevant.filter((p) => p.type === "tenue") : [];
  const order: FigurantPhoto["type"][] = ["portrait", "pied", "autre", "selfie"];
  const others = relevant
    .filter((p) => p.type !== "tenue")
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return [...tenue, ...others].slice(0, 3);
}
