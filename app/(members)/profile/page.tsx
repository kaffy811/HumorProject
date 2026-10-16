import { trustedGooglePhoto } from "@/lib/google-avatar";
import { requireMember, profileComplete } from "@/lib/profile";
import { ProfileForm } from "@/components/profile-form";
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const { profile, user } = await requireMember(false);
  const onboarding = !profileComplete(profile);

  return (
    <section className="member-page profile-page">
      <span className="eyebrow">YOUR LITTLE CORNER OF THE CLUB</span>
      <h1>{onboarding ? "First, a proper introduction." : "Your profile."}</h1>
      <p className="page-intro">
        {onboarding
          ? "Choose a username and optionally add a photo. Then your camera roll gets the mic."
          : "Update your username or profile photo."}
      </p>
      <ProfileForm
        profile={profile}
        avatarUrl={
          profile?.avatar_path
            ? `/api/profiles/${user.id}/avatar?v=${profile.updated_at}`
            : null
        }
        googlePhotoUrl={trustedGooglePhoto(user)}
        onboarding={onboarding}
      />
      {!onboarding && (
        <a className="text-link" href="/studio">
          Back to the caption studio ↗
        </a>
      )}
    </section>
  );
}
