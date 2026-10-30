import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { authAttemptKeys, trustedAuthIp } from "./auth-attempt-keys";

/** Shared DB limits; missing configuration or database failure denies the attempt. */
export async function consumeCandidateLoginAttempt(email: string): Promise<boolean> {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || email.length > 254) return false;
  try {
    const ip = trustedAuthIp(await headers(), process.env.VERCEL === "1");
    const { data, error } = await createAdminClient().rpc("consume_candidate_auth_limits", authAttemptKeys(email, ip, secret));
    return !error && data === true;
  } catch {
    return false;
  }
}
