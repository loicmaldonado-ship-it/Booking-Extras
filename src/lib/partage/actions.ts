"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type PartageType = "documents" | "essayages";

function genToken() {
  return randomUUID().replace(/-/g, "");
}

export async function getPartageToken(projetId: string, type: PartageType) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("partage_liens")
    .select("token")
    .eq("projet_id", projetId)
    .eq("type", type)
    .maybeSingle();
  return data?.token ?? null;
}

export async function createPartageLien(projetId: string, type: PartageType) {
  const supabase = createAdminClient();
  const token = genToken();
  await supabase.from("partage_liens").upsert(
    { projet_id: projetId, type, token },
    { onConflict: "projet_id,type" }
  );
  revalidatePath("/partage");
  revalidatePath("/essayages");
  return token;
}

export async function revokePartageLien(projetId: string, type: PartageType) {
  const supabase = createAdminClient();
  await supabase.from("partage_liens").delete().eq("projet_id", projetId).eq("type", type);
  revalidatePath("/partage");
  revalidatePath("/essayages");
}

export async function getJourneePartageLien(projetId: string, date: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("partage_journee_liens")
    .select("token, show_contacts")
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();
  return data ? { token: data.token, showContacts: data.show_contacts } : null;
}

export async function createJourneePartageLien(projetId: string, date: string, showContacts: boolean) {
  const supabase = createAdminClient();
  const token = genToken();
  await supabase.from("partage_journee_liens").upsert(
    { projet_id: projetId, date, show_contacts: showContacts, token },
    { onConflict: "projet_id,date" }
  );
  revalidatePath("/bookings/documents");
  return token;
}

export async function revokeJourneePartageLien(projetId: string, date: string) {
  const supabase = createAdminClient();
  await supabase.from("partage_journee_liens").delete().eq("projet_id", projetId).eq("date", date);
  revalidatePath("/bookings/documents");
}
