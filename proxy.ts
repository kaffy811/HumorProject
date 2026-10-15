import { dataSchema } from "@/lib/supabase/schema";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { config as supabaseConfig } from "@/lib/supabase/config";
import { isGoogleSession } from "@/lib/google-session";
import { profileComplete } from "@/lib/profile-complete";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login")
    return NextResponse.redirect(new URL("/", request.url));
  if (path === "/privacy" || path.startsWith("/auth/"))
    return NextResponse.next();
  const publicPost = /^\/post\/[^/]+$/.test(path);
  if (/^\/post\/[^/]+\/(thumbnail|opengraph-image)$/.test(path))
    return NextResponse.next();
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const db = createServerClient(url, key, {
    db: { schema: dataSchema() },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data, error } = user
    ? await db.auth.getClaims()
    : { data: null, error: null };
  const signedIn = !error && isGoogleSession(user, data?.claims);
  const redirectTo = (target: string) => {
    const result = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  };
  if (!signedIn && path !== "/" && !publicPost) {
    if (path.startsWith("/api/")) {
      const result = NextResponse.json(
        { error: "Sign in with Google to continue." },
        { status: 401 },
      );
      response.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
      return result;
    }
    return redirectTo("/");
  }
  if (signedIn && path === "/") return redirectTo("/feed");
  if (signedIn && !path.startsWith("/api/") && path !== "/profile") {
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("first_name,last_name,username,avatar_path,onboarded_at")
      .eq("id", user!.id)
      .maybeSingle();
    if (!profileError && !profileComplete(profile))
      return redirectTo("/profile");
    if (
      !profileError &&
      profileComplete(profile) &&
      !profile?.onboarded_at &&
      !publicPost &&
      (path !== "/create" ||
        request.nextUrl.searchParams.get("welcome") !== "1")
    )
      return redirectTo("/create?welcome=1");
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|baby/|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?)$).*)",
  ],
};
