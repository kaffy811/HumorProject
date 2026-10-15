/* eslint-disable @next/next/no-img-element -- Authenticated member photos. */
"use client";
import type { MemberProfile } from "@/lib/profile-contracts";
import { usePublicAuthor } from "@/stores/author-store";
export function ProfileHeader({
  profile,
  own,
  onEdit,
}: {
  profile: MemberProfile;
  own: boolean;
  onEdit: () => void;
}) {
  const author = usePublicAuthor(profile);
  return (
    <header className="profile-header">
      <div className="profile-header-main">
        {author.avatarUrl ? (
          <img
            className="profile-big-avatar"
            src={author.avatarUrl}
            alt=""
            width={112}
            height={112}
          />
        ) : (
          <span className="profile-big-avatar avatar-letter" aria-hidden="true">
            {author.name.slice(0, 1)}
          </span>
        )}
        <div>
          <h1>
            {author.name}{" "}
            {author.isOfficial && (
              <span className="host-label comic-label">HOST</span>
            )}
          </h1>
          <p className="profile-real-name">{[profile.firstName,profile.lastName].filter(Boolean).join(" ")}</p>
          <p className="profile-joined">
            Joined{" "}
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              year: "numeric",
              timeZone: "America/New_York",
            }).format(new Date(profile.joinedAt))}
          </p>
        </div>
        {own && (
          <button className="comic-button" onClick={onEdit}>
            Edit profile
          </button>
        )}
      </div>
      <dl className="profile-stats">
        <div>
          <dt>Posts</dt>
          <dd>{profile.postCount}</dd>
        </div>
        <div>
          <dt>Ha received</dt>
          <dd>{profile.haReceived}</dd>
        </div>
        <div>
          <dt>Best rank</dt>
          <dd>{profile.bestRank ? `#${profile.bestRank}` : "—"}</dd>
        </div>
      </dl>
    </header>
  );
}
