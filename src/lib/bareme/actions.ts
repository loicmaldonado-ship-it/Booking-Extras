"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChef } from "@/lib/auth/session";
import type { Convention } from "@/lib/projets/types";
import type { Cachet } from "@/lib/candidatures/types";
import type { MajorationValeurType } from "./types";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function createBaremeCachet(_prevState: unknown, formData: FormData) {
  await requireChef();

  const convention = str(formData, "convention") as Convention | null;
  const cachet = str(formData, "cachet") as Cachet | null;
  const montant = num(formData, "montant_brut");
  if (!convention || !cachet || montant === null) {
    return { error: "Convention, cachet et montant sont obligatoires." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bareme_cachets").insert({
    convention,
    cachet,
    montant_brut: montant,
    date_effet: str(formData, "date_effet") ?? new Date().toISOString().slice(0, 10),
    notes: str(formData, "notes"),
  });
  if (error) return { error: error.message };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function updateBaremeCachet(id: string, montantBrut: number, notes: string | null) {
  await requireChef();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bareme_cachets")
    .update({ montant_brut: montantBrut, notes })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function deleteBaremeCachet(id: string) {
  await requireChef();

  const supabase = createAdminClient();
  await supabase.from("bareme_cachets").delete().eq("id", id);
  revalidatePath("/bareme");
}

export async function createBaremeMajoration(_prevState: unknown, formData: FormData) {
  await requireChef();

  const convention = str(formData, "convention") as Convention | null;
  const label = str(formData, "label");
  const valeurType = str(formData, "valeur_type") as MajorationValeurType | null;
  if (!convention || !label || !valeurType) {
    return { error: "Convention, libellé et type de valeur sont obligatoires." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bareme_majorations").insert({
    convention,
    type: str(formData, "type") ?? label.toLowerCase().replace(/\s+/g, "_"),
    label,
    valeur_type: valeurType,
    valeur: num(formData, "valeur"),
    cinema_uniquement: formData.get("cinema_uniquement") === "on",
    notes: str(formData, "notes"),
    date_effet: str(formData, "date_effet") ?? new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.message };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function updateBaremeMajoration(id: string, valeur: number | null, notes: string | null) {
  await requireChef();

  const supabase = createAdminClient();
  const { error } = await supabase.from("bareme_majorations").update({ valeur, notes }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/bareme");
  return { success: true as const };
}

export async function deleteBaremeMajoration(id: string) {
  await requireChef();

  const supabase = createAdminClient();
  await supabase.from("bareme_majorations").delete().eq("id", id);
  revalidatePath("/bareme");
}
