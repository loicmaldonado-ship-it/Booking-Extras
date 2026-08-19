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

export function pickPortrait(photos: FigurantPhotoWithUrl[] | undefined) {
  return photos?.find((p) => p.type === "portrait") ?? null;
}

export function pickFichePhotos(photos: FigurantPhotoWithUrl[] | undefined) {
  if (!photos) return [];
  const order: FigurantPhoto["type"][] = ["portrait", "pied", "autre", "selfie"];
  const sorted = [...photos].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return sorted.slice(0, 3);
}
