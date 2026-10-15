import type { JokeStyle } from "./create-contracts";
export interface Post {
  id: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  caption: string;
  style: JokeStyle | "HANDMADE";
  author: { username?: string; id: string; name: string; avatarUrl: string | null; isOfficial?: boolean };
  createdAt: string;
  haCount: number;
  commentCount: number;
  viewerHasHa: boolean;
  viewerHasSaved: boolean;
  firstPostPending?: boolean;
}
export type PostSort = "hot" | "new" | "mine" | "saved";
export interface PostPage {
  posts: Post[];
  nextCursor: string | null;
  cutoff: string;
  mode: "live" | "mock";
  page?: number; totalCount?: number; totalPages?: number; snapshotId?: string;
}
export const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Inappropriate content",
  "Other",
] as const;
export function hotScore(count:number){return count;}
export function compareFeed(a:Post,b:Post,sort:PostSort){return (sort==="hot"?b.haCount-a.haCount:0)||Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id.localeCompare(a.id);}
export function imageRatio(width: number, height: number) {
  return Math.max(0.8, width / height);
}
export function relativeTime(createdAt: string, now = Date.now()) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(createdAt)) / 60000),
  );
  return minutes < 1
    ? "now"
    : minutes < 60
      ? `${minutes}m`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h`
        : `${Math.floor(minutes / 1440)}d`;
}
