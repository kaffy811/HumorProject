/* eslint-disable @typescript-eslint/no-unused-vars -- Fixture renderers intentionally strip browser-only props. */
// Read-only render fixtures for CSS inspection. They never authenticate or call APIs.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile, cp, readdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url),
  root = process.cwd(),
  out = path.resolve("/private/tmp/humor-layout-fixtures");
await mkdir(out, { recursive: true });
const modules = new Map();
let query = new URLSearchParams(),
  section = "feed";
let menuOpen = false, menuStateOrdinal = 0;
const viewer = "00000000-0000-4000-8000-000000000001";
const noop = () => {};
const posts = Array.from({ length: 9 }, (_, i) => ({
  id: `fixture-${i}`,
  caption:
    i < 4
      ? "The library closes before I finish pretending to study. A fiscal tragedy in three acts."
      : "An expensive coffee. A remarkably affordable personality.",
  style: i % 2 ? "HANDMADE" : "Deadpan",
  imageUrl: "/baby/smirk.png",
  imageWidth: 800,
  imageHeight: i % 3 === 0 ? 1000 : 800,
  author: {
    id: i % 2 ? `fixture-user-${i}` : viewer,
    name: i < 4 ? "@a_username_with_24_chars" : "@local_student",
    username: "local_student",
    avatarUrl: null,
  },
  createdAt: "2026-10-14T18:00:00Z",
  haCount: 9 - i,
  commentCount: 0,
  viewerHasHa: false,
  viewerHasSaved: false,
}));
const profile = {
  id: viewer,
  name: "@local_student",
  username: "local_student",
  avatarUrl: null,
  googlePhotoUrl: null,
  joinedAt: "2026-10-01T12:00:00Z",
  onboardedAt: "2026-10-01T12:00:00Z",
  postCount: 9,
  haReceived: 45,
  bestRank: 1,
};
const fixtureComments = [
  {id:"fixture-parent",postId:posts[0].id,body:"Absolutely. This is my entire contribution to the group project.",author:posts[1].author,createdAt:"2026-10-15T12:00:00Z",haCount:1,viewerHasHa:false,replyTo:null},
  {id:"fixture-reply",postId:posts[0].id,body:"Finally. A peer review I can afford.",author:posts[0].author,createdAt:"2026-10-15T12:05:00Z",haCount:20,viewerHasHa:false,replyTo:{id:"fixture-parent",authorName:posts[1].author.name,authorId:posts[1].author.id}},
];
posts[0].commentCount = fixtureComments.length;
const page = {
  posts,
  nextCursor: null,
  cutoff: "2026-10-14T20:00:00Z",
  snapshotId: "fixture-snapshot",
  totalPages: 1,
  totalCount: 9,
  mode: "mock",
};
const board = {
  posts: posts.map((p, i) => ({ ...p, rank: i + 1 })),
  people: posts.map((p, i) => ({
    rank: i + 1,
    user: p.author,
    haReceived: p.haCount,
    postCount: i + 1,
    bestPost: { id: p.id, caption: p.caption },
  })),
  standing: {
    bestPostRank: null,
    bestPostId: null,
    peopleRank: null,
    haReceived: 0,
  },
  window: "week",
  computedAt: "2026-10-14T20:00:00Z",
  startsAt: "2026-10-07T20:00:00Z",
  expiresAt: "2099-10-14T20:05:00Z",
};
function single(k) {
  if (!k) return undefined;
  const p = JSON.parse(k);
  if (p[0].startsWith("feed-")) return page;
  if (p[0] === "profile") return profile;
  if (p[0] === "post") return posts[0];
  if (p[0] === "recommendations") return { ...page, posts: posts.slice(1, 4) };
  if (p[0] === "leaderboard")
    return {
      ...board,
      posts: board.posts.slice(
        0,
        query.get("count") ? Number(query.get("count")) : 9,
      ),
    };
  if (p[0] === "notifications-summary")
    return { unreadCount: 12, latestAt: null };
}
const swr = {
  __esModule: true,
  default: (k) => ({
    data: single(k),
    isLoading: false,
    isValidating: false,
    error: null,
    mutate: async () => {},
  }),
  SWRConfig: ({ children }) => children,
  useSWRConfig: () => ({ cache: new Map(), mutate: async () => {} }),
};
const infinite = {
  __esModule: true,
  default: (getKey) => {
    const p = JSON.parse(getKey(0, null));
    const data =
      p[0] === "comments"
        ? { comments: fixtureComments, nextCursor: null, commentCount: 2 }
        : p[0] === "notifications"
          ? {
              items: [],
              nextCursor: null,
              summary: { unreadCount: 0, latestAt: null },
              mode: "mock",
            }
          : { ...page, posts: p[3] === "saved" ? [] : posts };
    return {
      data: [data],
      error: null,
      isValidating: false,
      size: 1,
      mutate: async () => {},
      setSize: async () => {},
    };
  },
};
function cleanProps(props, skip) {
  return Object.fromEntries(
    Object.entries(props).filter(([k]) => !skip.includes(k)),
  );
}
const motion = new Proxy(
  {},
  {
    get:
      (_, tag) =>
      ({ children, ...props }) =>
        React.createElement(
          tag,
          cleanProps(props, [
            "initial",
            "animate",
            "transition",
            "whileTap",
            "whileHover",
            "exit",
            "layout",
          ]),
          children,
        ),
  },
);
let createState;
const vanilla = require("zustand/vanilla"),
  feed = vanilla.createStore(() => ({
    detailBack: null,
    detailReturn: null,
    markDetailEntry: noop,
    consumeDetailReturn: noop,
  }));
const mascot = vanilla.createStore(() => ({
  mood: "smirk",
  setMood: noop,
  resetMood: noop,
  poke: noop,
}));
const stores = {
  StoreProvider: ({ children }) => children,
  useStores: () => ({
    feed,
    mascot,
    create: { getState: () => createState, subscribe: () => noop },
  }),
  useMascot: (f) => f(mascot.getState()),
  useCreate: (f) => f({ ...createState, dispatch: noop }),
};
function load(file) {
  file = path.resolve(root, file);
  if (modules.has(file)) return modules.get(file).exports;
  const m = { exports: {} };
  modules.set(file, m);
  new Function(
    "module",
    "exports",
    "require",
    ts.transpile(readFileSync(file, "utf8"), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    }),
  )(m, m.exports, (id) => {
    if (id === "react" && file.endsWith("/UserMenu.tsx")) return {...React,useState: initial => React.useState(menuOpen && menuStateOrdinal++ === 0 ? true : initial)};
    if (id === "server-only") return {};
    if (id === "swr") return swr;
    if (id === "swr/infinite") return infinite;
    if (id === "framer-motion")
      return {
        motion,
        AnimatePresence: ({ children }) => children,
        useReducedMotion: () => true,
        useAnimationControls: () => ({ start: async () => {}, set: noop }),
      };
    if (id === "next/navigation")
      return {
        useRouter: () => ({ push: noop, replace: noop, refresh: noop }),
        usePathname: () => "/" + section,
        useSearchParams: () => query,
      };
    if (id === "next/image")
      return {
        __esModule: true,
        default: ({ fill, priority, quality, unoptimized, ...props }) =>
          React.createElement(
            "img",
            cleanProps(
              {
                ...props,
                style: {
                  ...props.style,
                  ...(fill
                    ? { width: "100%", height: "100%", position: "absolute" }
                    : {}),
                },
              },
              [],
            ),
          ),
      };
    if (id === "next/link")
      return {
        __esModule: true,
        default: ({ children, ...props }) =>
          React.createElement(
            "a",
            cleanProps(props, ["scroll", "prefetch", "replace"]),
            children,
          ),
      };
    if (id === "@/stores/StoreProvider") return stores;
    if (id.startsWith("@/") || id.startsWith(".")) {
      const base = id.startsWith("@/")
        ? path.join(root, id.slice(2))
        : path.resolve(path.dirname(file), id);
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"])
        if (existsSync(base + ext)) return load(base + ext);
    }
    return require(id);
  });
  return m.exports;
}
const shell = load("components/shell/AppShell.tsx").AppShell,
  types = load("stores/create-store.ts");
createState = { ...types.initialState, dispatch: noop };
const cssFiles = (await readdir(".next/static/css")).filter((x) =>
  x.endsWith(".css"),
);
const css = (
  await Promise.all(
    cssFiles.map((f) => readFile(".next/static/css/" + f, "utf8")),
  )
).join("\n");
await writeFile(path.join(out, "styles.css"), css);
await cp("public/baby", path.join(out, "baby"), { recursive: true });
const views = [
  "feed",
  "notification-menu",
  "top",
  "people",
  "me",
  "saved",
  "edit",
  "profile",
  "create",
  "writing",
  "upload-pending",
  "upload-ready",
  "handmade",
  "detail",
  "notifications",
  "u",
  "landing",
  "privacy",
  "top-1",
  "top-2",
];
for (const view of views) {
  menuOpen = view === "notification-menu";menuStateOrdinal=0;
  section =
    view === "people"
      ? "top"
      : view === "saved" || view === "edit"
        ? "me"
        : view;
  query = new URLSearchParams(
    view === "people"
      ? "board=people"
      : view === "saved"
        ? "tab=saved"
        : view === "edit"
          ? "edit=1"
          : view === "top-1"
            ? "count=1"
            : view === "top-2"
              ? "count=2"
              : "",
  );
  createState = { ...types.initialState, dispatch: noop };
  let element;
  if (["create", "writing", "handmade", "upload-pending", "upload-ready"].includes(view)) {
    if (view !== "create")
      createState = {
        ...createState,
        writingMode: view === "handmade" ? "handmade" : "ai",
        step: 2,
        phase: "ready",
        image: {
          uploadId: "fixture",
          previewUrl: "/baby/smirk.png",
          filename: "local-fixture.png",
          mimeType: "image/png",
          bytes: 10,
        },
        draftId: "fixture",
        handmadeText: "An expensive coffee. A cheap personality.",
      };
    if (view.startsWith("upload-")) createState = {
      ...createState,step:1,phase:view === "upload-pending" ? "uploading" : "ready",
      image:{...createState.image,uploadId:view === "upload-pending" ? null : "fixture"},
    };
    element = React.createElement(
      load("components/create/CreateFlow.tsx").CreateFlow,
      { author: profile, welcome: true },
    );
  } else if (["me", "saved", "edit", "u"].includes(view))
    element = React.createElement(
      load("components/profile/ProfilePage.tsx").ProfilePage,
      { id: view === "u" ? "fixture-other" : viewer },
    );
  else if (view === "profile")
    element = React.createElement(
      "section",
      { className: "member-page profile-page" },
      React.createElement("h1", null, "First, a proper introduction."),
      React.createElement(load("components/profile-form.tsx").ProfileForm, {
        profile: null,
        avatarUrl: null,
        googlePhotoUrl: null,
        onboarding: true,
      }),
    );
  else if (view === "landing")
    element = React.createElement(
      load("components/baby-landing.tsx").BabyLanding,
      { googleEnabled: true, callbackError: false },
    );
  else if (view === "privacy")
    element = React.createElement(load("app/privacy/page.tsx").default);
  else if (view === "detail")
    element = React.createElement(
      load("components/detail/PostDetail.tsx").PostDetail,
      { id: posts[0].id },
    );
  else if (view === "notifications")
    element = React.createElement(
      load("components/notifications/NotificationsPage.tsx").NotificationsPage,
    );
  else if (view === "top" || view === "people" || view.startsWith("top-"))
    element = React.createElement(
      load("components/leaderboard/Leaderboard.tsx").Leaderboard,
    );
  else element = React.createElement(load("components/feed/Feed.tsx").Feed);
  let body = renderToStaticMarkup(
    ["landing", "privacy"].includes(view)
      ? element
      : React.createElement(
          shell,
          { author: profile, viewerId: viewer },
          element,
        ),
  );
  if (view === "edit") body = body.replace("<dialog", "<dialog open");
  await writeFile(
    path.join(out, view + ".html"),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>Local CSS fixture · ${view}</title></head><body>${body}</body></html>`,
  );
}
console.log(
  `Rendered ${views.length} read-only fixture pages using existing components and compiled CSS. No API calls or database writes. ${out}`,
);
