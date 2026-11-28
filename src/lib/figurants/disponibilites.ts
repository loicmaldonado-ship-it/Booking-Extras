"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
async function getFigurantIdByToken(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("figurants").select("id").eq("token_disponibilite", token).single();
  return data?.id ?? null;
}

export async function addIndisponibilite(token: string, date: string) {
  const figurantId = await getFigurantIdByToken(token);
  if (!figurantId) return { error: "Lien invalide." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("figurant_indisponibilites")
    .upsert({ figurant_id: figurantId, date }, { onConflict: "figurant_id,date" });

  if (error) return { error: error.message };

  revalidatePath(`/disponibilites/${token}`);
  revalidatePath(`/figurants/${figurantId}`);
  return {};
}

// Pour signaler un conflit quand on booke quelqu'un un jour où il/elle a
// déclaré être indisponible — clé "figurantId|date" pour un lookup direct.
export async function getIndisponibilitesForFigurants(
  projetId: string,
  figurantIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();

  if (
    !projetId ||
    figurantIds.length === 0 ||
    (await checkProjetAccess(projetId))
  ) {
    return map;
  }

  const supabase = createAdminClient();

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("figurant_id")
    .eq("projet_id", projetId)
    .in("figurant_id", figurantIds);

  if (bookingsError || !bookings?.length) {
    return map;
  }

  const authorizedIds = [
    ...new Set(bookings.map((booking) => booking.figurant_id)),
  ];

  const { data } = await supabase
    .from("figurant_indisponibilites")
    .select("figurant_id, date, motif")
    .in("figurant_id", authorizedIds);

  for (const row of data ?? []) {
    map.set(`${row.figurant_id}|${row.date}`, row.motif);
  }

  return map;
}

export async function removeIndisponibilite(token: string, date: string) {
  const figurantId = await getFigurantIdByToken(token);
  if (!figurantId) return { error: "Lien invalide." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("figurant_indisponibilites")
    .delete()
    .eq("figurant_id", figurantId)
    .eq("date", date);
  if (error) return { error: error.message };

  revalidatePath(`/disponibilites/${token}`);
  revalidatePath(`/figurants/${figurantId}`);
  return {};
}
