import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/supabase/config";
import { RETURN_COOKIE, safeReturnPath } from "./auth-return";

// Supabase's configured production Site URL. All production aliases enter
// OAuth here *before* creating host-only PKCE and return-path cookies.
export const PRODUCTION_AUTH_ORIGIN =
  "https://humor-project-humor-project8.vercel.app";

export async function startGoogleAuth(request: NextRequest) {
  const incoming = new URL(request.url);
  const target = safeReturnPath(incoming.searchParams.get("next")) || "/feed";
  const origin = process.env.VERCEL_ENV === "production"
    ? PRODUCTION_AUTH_ORIGIN : incoming.origin;
  const response = NextResponse.redirect(new URL("/auth/error?reason=unavailable", origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  if (incoming.origin !== origin) {
    const start = new URL("/auth/start", origin);
    start.searchParams.set("next", target);
    response.headers.set("Location", start.toString());
    return response;
  }

  try {
    const { url, key } = config();
    const db = createServerClient(url, key, {
      cookieOptions: { secure: incoming.protocol === "https:", sameSite: "lax", path: "/" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: values => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true },
    });
    if (error || !data.url) return response;
    response.cookies.set(RETURN_COOKIE, target, {
      httpOnly: true, secure: incoming.protocol === "https:",
      sameSite: "lax", path: "/", maxAge: 600,
    });
    response.headers.set("Location", data.url);
  } catch {
    console.error("Sign-in start failed", { stage: "prepare-google" });
  }
  return response;
}
