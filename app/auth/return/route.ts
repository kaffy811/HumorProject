import { cookies } from "next/headers";
import { RETURN_COOKIE, safeReturnPath } from "@/lib/auth-return";
import { sameOrigin } from "@/lib/humor-validation";
import { memberAuth } from "@/lib/member-auth";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 1500)
    return Response.json({ error: "Invalid return path." }, { status: 400 });
  let target;
  try {
    target = safeReturnPath(JSON.parse(raw).target);
  } catch {
    target = null;
  }
  if (!target)
    return Response.json({ error: "Invalid return path." }, { status: 400 });
  const response = Response.json({ ok: true });
  const jar = await cookies();
  jar.set(RETURN_COOKIE, target, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  const { user, db } = await memberAuth();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const jar = await cookies(),
    stored = safeReturnPath(jar.get(RETURN_COOKIE)?.value);
  const { data: profile, error } = await db
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "Your profile could not be loaded." },
      { status: 503 },
    );
  const target =
    stored && /^\/post\/[^/?#]+(?:[?#]|$)/.test(stored)
      ? stored
      : !profile?.onboarded_at
        ? "/create?welcome=1"
        : stored || "/feed";
  jar.delete(RETURN_COOKIE);
  return Response.json(
    { target },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
