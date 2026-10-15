import type { Post } from "./post-contracts";
export type PublicAuthor = Post["author"];
export interface MemberProfile extends PublicAuthor {
  username: string;
  firstName: string;
  lastName: string;
  joinedAt: string;
  googlePhotoUrl?: string | null;
  onboardedAt: string | null;
  postCount: number;
  haReceived: number;
  bestRank: number | null;
}
export const MAX_AVATAR_BYTES = 5_000_000;
