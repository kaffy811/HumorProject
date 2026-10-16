import { ensurePreviewProfile } from "@/lib/preview-profile";
import { dataSchema } from "@/lib/supabase/schema";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/supabase/config";
import { loginDestination } from "@/lib/login-destination";
import { RETURN_COOKIE, safeReturnPath } from "./auth-return";
import { isGoogleSession } from "@/lib/google-session";
export async function finishAuth(
  request: NextRequest,
  mode: "code" | "email" | "resume",
) {
  const target = safeReturnPath(request.cookies.get(RETURN_COOKIE)?.value);
  const response = NextResponse.redirect(new URL("/feed", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  const fail = (reason: "session" | "profile" | "unavailable") => {
    response.headers.set(
      "Location",
      new URL(`/auth/error?reason=${reason}`, request.url).toString(),
    );
    return response;
  };
  let stage = "configure";
  try {
    const { url, key } = config();
    const db = createServerClient(url, key, {
      db: { schema: dataSchema() },
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
    if (mode === "code" && code) {
      stage = "exchange";
      // An already-consumed callback can still have a valid Google session.
      // Never trust the exchange alone: verify the resulting session below.
      try {
        const flowId = incoming.searchParams.get("sb_flow_id");
        await db.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      } catch {
        // A prior successful exchange may already have established cookies.
      }
    }
    stage = "verify-session";
    const {
      data: { user },
      error: userError,
    } = await db.auth.getUser();
    if (userError || !user) return fail("session");
    const { data: verified, error: claimsError } = await db.auth.getClaims();
    if (claimsError || !isGoogleSession(user, verified?.claims))
      return fail("session");
    stage = "load-profile";
    await ensurePreviewProfile(user.id);
    const { data: profile, error } = await db
      .from("profiles")
      .select("first_name,last_name,username,avatar_path,onboarded_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return fail("profile");
    const destination = loginDestination(profile, target);
    response.headers.set(
      "Location",
      new URL(destination, request.url).toString(),
    );
    if (destination !== "/profile") response.cookies.delete(RETURN_COOKIE);
    return response;
  } catch {
    // Never log callback codes, identity data or session cookies.
    console.error("Sign-in callback failed", { stage });
    return fail("unavailable");
  }
}
