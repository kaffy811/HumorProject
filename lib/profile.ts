import { redirect } from "next/navigation";
import { memberAuth } from "@/lib/member-auth";
import { profileComplete, type Profile } from "@/lib/profile-complete";
export { profileComplete, type Profile } from "@/lib/profile-complete";
export async function requireMember(complete = true) {
  const { db, user } = await memberAuth();
  if (!user) redirect("/");
  const { data: profile, error } = await db
    .from("profiles")
    .select(
      "username,avatar_path,onboarded_at,updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (error)
    throw new Error("Your profile could not be loaded. Please try again.");
  if (complete && !profileComplete(profile)) redirect("/profile");
  return { db, user, profile: profile as Profile | null };
}
