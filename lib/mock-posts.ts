import "server-only";
import { randomUUID } from "node:crypto";
import {
  hotScore,
  type Post,
  type PostPage,
  type PostSort,
} from "./post-contracts";
const captions = [
  "My GPA and this plant have agreed to stop growing.",
  "A downtown studio. The kitchen is also the bedroom.",
  "I came for the view. The rent stayed for my organs.",
  "The textbooks are structural. They support the vibe, not my GPA.",
  "Coffee is a meal if you stop asking questions.",
  "A very expensive place to remember I have homework.",
];
type Session = {
  posts: Post[];
  reports: Set<string>;
  saves: Map<string, number>;
  saveRequests: Map<string, { id: string; viewerHasSaved: boolean }>;
  cutoff: string;
  added?: boolean;
  requests: Map<string, { haCount: number; viewerHasHa: boolean }>;
};
const state = globalThis as typeof globalThis & {
  humorMockFeed?: {
    sessions: Map<string, Session>;
    snapshots: Map<
      string,
      { owner: string; sort: PostSort; ids: string[]; cutoff: string }
    >;
  };
};
state.humorMockFeed ||= { sessions: new Map(), snapshots: new Map() };
const { sessions, snapshots } = state.humorMockFeed;
function session(user: string) {
  let s = sessions.get(user);
  if (!s) {
    const now = Date.now();
    s = {
      cutoff: new Date(now).toISOString(),
      reports: new Set(),
      saves: new Map(),
      saveRequests: new Map(),
      requests: new Map(),
      posts: Array.from({ length: 30 }, (_, i) => ({
        id: `mock-${i + 1}`,
        caption: captions[i % captions.length],
        imageUrl: `/baby/${["smirk", "huh", "pout", "giggle", "wink", "smug"][i % 6]}.png`,
        imageWidth: 800,
        imageHeight: i % 3 === 0 ? 1200 : 800,
        style: ["Deadpan", "Roast", "Pun", "Dad joke", "Absurd", "Wholesome"][
          i % 6
        ] as Post["style"],
        author: {
          id: i % 5 === 0 ? user : `mock-author-${i % 4}`,
          name: i % 5 === 0 ? "You" : ["Sam", "Alex", "Morgan", "Jules"][i % 4],
          avatarUrl: null,
        },
        createdAt: new Date(now - (i + 1) * 3600000).toISOString(),
        haCount: 30 - i,
        commentCount: i % 7,
        viewerHasHa: false,
        viewerHasSaved: false,
      })),
    };
    sessions.set(user, s);
    if (sessions.size > 100) sessions.delete(sessions.keys().next().value!);
  }
  return s;
}
export function mockList(
  user: string,
  sort: PostSort,
  cursor: string | null,
  limit: number,
): PostPage {
  const s = session(user);
  let offset = 0,
    key = "";
  if (cursor) {
    const parts = cursor.split(":");
    key = parts[0];
    offset = Number(parts[1]);
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new Error("Invalid mock cursor");
  } else {
    key = randomUUID();
    const ordered = s.posts
      .filter((p) =>
        sort === "saved"
          ? p.viewerHasSaved
          : sort === "mine"
            ? p.author.id === user
            : true,
      )
      .sort((a, b) =>
        sort === "saved"
          ? (s.saves.get(b.id) || 0) - (s.saves.get(a.id) || 0)
          : sort === "hot"
            ? hotScore(b.haCount, b.createdAt) -
              hotScore(a.haCount, a.createdAt)
            : Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    snapshots.set(key, {
      owner: user,
      sort,
      ids: ordered.map((p) => p.id),
      cutoff: new Date().toISOString(),
    });
    if (snapshots.size > 200) snapshots.delete(snapshots.keys().next().value!);
  }
  const snapshot = snapshots.get(key);
  if (!snapshot || snapshot.owner !== user || snapshot.sort !== sort)
    throw new Error("Invalid mock cursor");
  return {
    posts: snapshot.ids.slice(offset, offset + limit).flatMap((id) => {
      const p = s.posts.find((post) => post.id === id);
      return p && (sort !== "saved" || p.viewerHasSaved) ? [{ ...p }] : [];
    }),
    nextCursor:
      offset + limit < snapshot.ids.length ? `${key}:${offset + limit}` : null,
    cutoff: snapshot.cutoff,
    mode: "mock",
  };
}
export function mockAction(
  user: string,
  id: string,
  kind: "ha" | "save" | "delete" | "report",
  requestKey?: string,
) {
  const s = session(user),
    p = s.posts.find((x) => x.id === id);
  if (!p) throw new Error("Post not found");
  if (kind === "ha") {
    if (requestKey && s.requests.has(requestKey))
      return s.requests.get(requestKey)!;
    p.viewerHasHa = !p.viewerHasHa;
    p.haCount += p.viewerHasHa ? 1 : -1;
    const result = { haCount: p.haCount, viewerHasHa: p.viewerHasHa };
    if (requestKey) s.requests.set(requestKey, result);
    return result;
  }
  if (kind === "save") {
    const previous = requestKey ? s.saveRequests.get(requestKey) : undefined;
    if (previous) {
      if (previous.id !== id) throw new Error("Invalid request");
      return { viewerHasSaved: previous.viewerHasSaved };
    }
    p.viewerHasSaved = !p.viewerHasSaved;
    if (p.viewerHasSaved) s.saves.set(id, Date.now());
    else s.saves.delete(id);
    const result = { viewerHasSaved: p.viewerHasSaved };
    if (requestKey) s.saveRequests.set(requestKey, { id, ...result });
    return result;
  }
  if (kind === "delete") {
    if (p.author.id !== user)
      throw new Error("Only the author can delete this post");
    s.posts = s.posts.filter((x) => x.id !== id);
  } else s.reports.add(id);
  return { ok: true };
}

// Preview-only: introduce one synthetic post on the first 60-second check.
export function mockCheck(user: string, since: string) {
  const s = session(user);
  if (!s.added && s.posts.length) {
    s.added = true;
    s.posts.unshift({
      ...s.posts[0],
      id: "mock-new",
      caption: "Breaking: I have once again done anything except my homework.",
      createdAt: new Date().toISOString(),
      haCount: 40,
      viewerHasHa: false,
      viewerHasSaved: false,
      author: { id: "mock-sam", name: "Sam", avatarUrl: null },
    });
  }
  return s.posts.filter((p) => Date.parse(p.createdAt) > Date.parse(since))
    .length;
}
