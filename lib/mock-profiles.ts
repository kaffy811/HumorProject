import "server-only";
import type { MemberProfile } from "./profile-contracts";
import { mockList, mockUpdateAuthor } from "./mock-posts";
import { mockLeaderboard } from "./mock-leaderboard";
const state = globalThis as typeof globalThis & {
  humorMockProfiles?: Map<string, MemberProfile>;
  humorMockAvatars?: Map<
    string,
    { owner: string; bytes: Uint8Array; expires: number }
  >;
};
state.humorMockProfiles ||= new Map();
state.humorMockAvatars ||= new Map();
export function mockProfile(owner: string, id: string): MemberProfile | null {
  const posts = [];
  let cursor: string | null = null;
  do {
    const page = mockList(owner, "new", cursor, 12);
    posts.push(...page.posts);
    cursor = page.nextCursor;
  } while (cursor);
  const mine = posts.filter((p) => p.author.id === id),
    author = mine[0]?.author;
  if (!author && id !== owner) return null;
  const override = state.humorMockProfiles!.get(`${owner}:${id}`);
  return {
    ...(author || { id, name: "@you", username: "you", avatarUrl: null }),
    username: author?.username || (id === owner ? "you" : "member"),
    firstName: "Local",
    lastName: "Member",
    joinedAt: "2026-10-01T12:00:00Z",
    onboardedAt: new Date().toISOString(),
    ...override,
    postCount: mine.length,
    haReceived: mine.reduce((n, p) => n + p.haCount, 0),
    bestRank:
      mockLeaderboard(owner, "all").posts.find((p) => p.author.id === id)
        ?.rank ?? null,
  };
}
export function mockSaveProfile(
  owner: string,
  fields: { username: string; first_name: string; last_name: string },
  upload?: string,
  action?: string,
) {
  const value = mockProfile(owner, owner)!;
  if (upload && !mockAvatar(owner, upload))
    throw Error("Avatar preview expired.");
  const updated = {
    ...value,
    name: `@${fields.username}`,
    username: fields.username,
    firstName: fields.first_name,
    lastName: fields.last_name,
    ...(action === "remove" ? { avatarUrl: null } : {}),
    ...(upload
      ? { avatarUrl: `/api/profile/avatar/preview?id=${upload}` }
      : {}),
  };
  state.humorMockProfiles!.set(`${owner}:${owner}`, updated);
  mockUpdateAuthor(owner,updated);
  return updated;
}
export function mockStageAvatar(owner: string, id: string, bytes: Uint8Array) {
  state.humorMockAvatars!.set(id, {
    owner,
    bytes,
    expires: Date.now() + 86400000,
  });
  if (state.humorMockAvatars!.size > 100)
    state.humorMockAvatars!.delete(
      state.humorMockAvatars!.keys().next().value!,
    );
}
export function mockAvatar(owner: string, id: string) {
  const value = state.humorMockAvatars!.get(id);
  return value?.owner === owner && value.expires > Date.now()
    ? value.bytes
    : null;
}
export function mockAbandonAvatar(owner: string, id: string) {
  if (
    state
      .humorMockProfiles!.get(`${owner}:${owner}`)
      ?.avatarUrl?.includes(`id=${id}`)
  )
    return;
  const v = state.humorMockAvatars!.get(id);
  if (v?.owner === owner) state.humorMockAvatars!.delete(id);
}
