import "server-only";
import type { NotificationPage } from "./notification-contracts";
const state = globalThis as typeof globalThis & {
  humorMockNotificationRead?: Set<string>;
};
state.humorMockNotificationRead ||= new Set();
const at = new Date().toISOString();
export function mockInbox(owner: string, open = false): NotificationPage {
  const unread = !state.humorMockNotificationRead!.has(owner);
  const items = [
    {
      id: "mock-notification-ha",
      actor: { id: "mock-author-1", name: "Alex", avatarUrl: null },
      type: "ha" as const,
      postId: "mock-1",
      commentId: null,
      createdAt: at,
      wasUnread: unread,
      actorCount: 5,
      thumbnailUrl: "/baby/smirk.png",
    },
  ];
  if (open) state.humorMockNotificationRead!.add(owner);
  return {
    items,
    nextCursor: null,
    summary: {
      unreadCount: open || !unread ? 0 : 1,
      latestAt: open || !unread ? null : at,
    },
    mode: "mock",
  };
}
