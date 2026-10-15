"use client";
import { useRouter } from "next/navigation";
import { safeReturnPath } from "@/lib/auth-return";
import type { Profile } from "@/lib/profile";
import { ProfileFieldsForm } from "./profile/ProfileFieldsForm";
export function ProfileForm({
  profile,
  avatarUrl,
  googlePhotoUrl,
  onboarding,
}: {
  profile: Profile | null;
  avatarUrl: string | null;
  googlePhotoUrl: string | null;
  onboarding: boolean;
}) {
  const router = useRouter();
  return (
    <div className="profile-setup-card comic-card">
      <ProfileFieldsForm
        initial={{
          username: profile?.username || "",
          firstName: profile?.first_name || "",
          lastName: profile?.last_name || "",
          avatarUrl,
          googlePhotoUrl,
        }}
        submitLabel={onboarding ? "Save and enter the club" : "Save changes"}
        onSaved={async () => {
          if (onboarding) {
            const r = await fetch("/auth/return", {
              method: "DELETE",
              cache: "no-store",
            });
            if (!r.ok) throw Error("Your profile saved. Try entering again.");
            const d = await r.json();
            router.replace(safeReturnPath(d.target) || "/create?welcome=1");
          }
          router.refresh();
        }}
      />
    </div>
  );
}
