import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Session-aware client (respects RLS): use this whenever the query result
// should depend on who's logged in (auth, profile, team). For data reads
// that intentionally bypass RLS, use createAdminClient instead.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render: middleware refreshes
            // the session cookie instead, so this is safe to ignore.
          }
        },
      },
    }
  );
}
