import { dataSchema } from "@/lib/supabase/schema";
import "server-only";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { config } from "@/lib/supabase/config";
import { memberAuth } from "@/lib/member-auth";
import { profileComplete } from "@/lib/profile-complete";
import { sameOrigin } from "@/lib/humor-validation";
export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function studioContext(request: Request) {
  if (!sameOrigin(request)) throw new StudioError("Invalid origin.", 403);
  const { db, user } = await memberAuth();
  if (!user) throw new StudioError("Sign in with Google to continue.", 401);
  const { data: profile, error } = await db
    .from("profiles")
    .select("first_name,last_name,username,avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (error)
    throw new StudioError("Your profile could not be loaded. Try again.", 503);
  if (!profileComplete(profile))
    throw new StudioError(
      "Finish your name and username in Profile first.",
      403,
    );
  const secret =
    mockEnabled()?config().key:process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret)
    throw new StudioError("The studio is awaiting server configuration.", 503);
  const admin = createAdmin(config().url, secret, {
    db: {schema: dataSchema()},
      auth: { persistSession: false, autoRefreshToken: false },
  });
  return { db, user, admin };
}
export async function readJson(request: Request) {
  if (Number(request.headers.get("content-length")) > 8192)
    throw new StudioError("That request is too large.", 413);
  const text = await request.text();
  if (text.length > 8192)
    throw new StudioError("That request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new StudioError("Invalid request. Try again.");
  }
}
export function studioFailure(error: unknown) {
  if (error instanceof StudioError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Studio request failed",
    error instanceof Error ? error.name : "unknown",
  );
  return Response.json(
    { error: "The studio stumbled. Your draft is still here. Try again." },
    { status: 503 },
  );
}
export function mockEnabled() {
  return (
    process.env.CAPTION_GENERATION_MODE === "mock" &&
    process.env.VERCEL_ENV !== "production"
  );
}
