import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** A shared DB counter works across Vercel instances; deny when DB is unavailable. */
export async function consumeCandidateLoginAttempt(email: string): Promise<boolean> {
  const keyHash = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  const { data, error } = await createAdminClient().rpc("consume_candidate_auth_attempt", {
    p_key_hash: keyHash,
  });
  return !error && data === true;
}
