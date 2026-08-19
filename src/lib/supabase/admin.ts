import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. Never import this from a
// client component. Used until the Auth & Rôles section wires up per-user
// sessions and RLS-driven access.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
