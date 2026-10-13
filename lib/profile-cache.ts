import type { Post } from "./post-contracts";
import type { MemberProfile } from "./profile-contracts";
export type CachedProfile = MemberProfile & {
  postCounts?: Record<string, number>;
};
export function patchProfileCounts(
  profile: CachedProfile,
  post: Post,
  change: Partial<Post> | null,
): CachedProfile {
  const before = profile.postCounts?.[post.id] ?? post.haCount,
    next = change?.haCount ?? before;
  return {
    ...profile,
    postCounts: {
      ...profile.postCounts,
      [post.id]: change === null ? 0 : next,
    },
    postCount: Math.max(0, profile.postCount + (change === null ? -1 : 0)),
    haReceived: Math.max(
      0,
      profile.haReceived + (change === null ? -before : next - before),
    ),
  };
}
