import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_STARTED_AT_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-timeout";

const PUBLIC_PREFIXES = [
  "/login",
  "/auth/invite",
  "/postuler",
  "/confidentialite",
  "/disponibilites",
  "/partage/documents",
  "/partage/essayages",
  "/partage/casting",
  "/casting/upload",
  "/compte",
  "/manifest.ts",
  "/icon",
  "/apple-icon",
  "/offline",
];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const startedAtRaw = request.cookies.get(SESSION_STARTED_AT_COOKIE)?.value;
    const startedAt = startedAtRaw ? Number(startedAtRaw) : null;
    const sessionAgeMs = startedAt ? Date.now() - startedAt : 0;

    if (startedAt && sessionAgeMs > SESSION_MAX_AGE_SECONDS * 1000) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      const signedOutResponse = NextResponse.redirect(url);
      signedOutResponse.cookies.delete(SESSION_STARTED_AT_COOKIE);
      return signedOutResponse;
    }

    // Pas de cookie (session déjà ouverte avant ce déploiement, ou perdu) —
    // on redémarre le compte à zéro plutôt que de déconnecter à froid.
    if (!startedAt) {
      response.cookies.set(SESSION_STARTED_AT_COOKIE, Date.now().toString(), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
    }
  }

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|sw\\.js|fonts/).*)"],
};
