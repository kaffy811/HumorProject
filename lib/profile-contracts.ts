import type { Post } from "./post-contracts";
export type PublicAuthor = Post["author"];
export interface MemberProfile extends PublicAuthor {
  username: string;
  joinedAt: string;
  onboardedAt: string | null;
  postCount: number;
  haReceived: number;
  bestRank: number | null;
}
export function displayName(value: unknown) {
  if (typeof value !== "string") throw new Error("Give us a name.");
  const name = value.trim();
  if (
    Array.from(name).length < 2 ||
    Array.from(name).length > 30 ||
    /[\u0000-\u001f\u007f]/.test(name)
  )
    throw new Error("Use 2–30 characters for your name.");
  return name;
}
export const MAX_AVATAR_BYTES = 5_000_000;
