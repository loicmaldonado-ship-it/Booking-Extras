"use server";

import { revalidatePath } from "next/cache";
import {
  checkEmailReplies as checkEmailRepliesInbox,
  getUnreviewedReplies,
  clearUnreviewedReplies as clearUnreviewedRepliesInbox,
} from "@/lib/email/inbox";

// Relève les nouveaux mails puis renvoie la liste complète et persistée des
// réponses pas encore effacées, pour que le panneau accumule d'un contrôle à
// l'autre au lieu de ne montrer que les tout derniers mails reçus.
export async function checkEmailReplies() {
  const result = await checkEmailRepliesInbox();
  if (result.matched.length > 0) {
    revalidatePath("/figurants");
    revalidatePath("/bookings/documents");
  }
  const replies = result.error ? [] : await getUnreviewedReplies();
  return { ...result, replies };
}

export async function clearUnreviewedReplies() {
  await clearUnreviewedRepliesInbox();
  revalidatePath("/bookings/documents");
}
