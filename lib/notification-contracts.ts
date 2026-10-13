import type { PublicAuthor } from "./profile-contracts";
export interface NotificationItem {
  id: string;
  actor: PublicAuthor;
  type: "ha" | "comment" | "reply";
  postId: string;
  commentId: string | null;
  createdAt: string;
  wasUnread: boolean;
  actorCount: number;
  thumbnailUrl: string;
}
export interface NotificationSummary {
  unreadCount: number;
  latestAt: string | null;
}
export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
  summary: NotificationSummary;
  mode?: "live" | "mock";
}
export function notificationText(item: NotificationItem) {
  const who =
    item.actor.name +
    (item.actorCount > 1
      ? ` and ${item.actorCount - 1} other${item.actorCount === 2 ? "" : "s"}`
      : "");
  return `${who} ${item.type === "ha" ? "laughed at your post" : item.type === "reply" ? "replied to your comment" : "commented on your post"}`;
}
export function notificationHref(item: NotificationItem) {
  return `/post/${item.postId}${item.type === "ha" ? "" : `?comment=${encodeURIComponent(item.commentId || "")}#comments`}`;
}
