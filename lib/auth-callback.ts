import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/supabase/config";
import { profileComplete } from "@/lib/profile";
import { RETURN_COOKIE, safeReturnPath } from "./auth-return";
import { isGoogleSession } from "@/lib/google-session";
export async function finishAuth(request: NextRequest, mode: "code" | "email") {
  const target =
    safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value) || "/feed";
  const response = NextResponse.redirect(new URL(target, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  const { url, key } = config();
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const incoming = new URL(request.url);
  const code = incoming.searchParams.get("code");
  const result =
    mode === "code" && code ? await db.auth.exchangeCodeForSession(code) : null;
  if (!result || result.error) {
    response.headers.set(
      "Location",
      new URL("/?error=callback", request.url).toString(),
    );
    return response;
  }
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: verified, error: claimsError } = await db.auth.getClaims();
  if (claimsError || !isGoogleSession(user, verified?.claims)) {
    await db.auth.signOut();
    response.headers.set(
      "Location",
      new URL("/?error=google", request.url).toString(),
    );
  } else {
    const { data: profile, error } = await db
      .from("profiles")
      .select("first_name,last_name,username,avatar_path")
      .eq("id", user!.id)
      .maybeSingle();
    if (error || !profileComplete(profile))
      response.headers.set(
        "Location",
        new URL("/profile", request.url).toString(),
      );
    else response.cookies.delete(RETURN_COOKIE);
  }
  return response;
}
