"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { NewPostsNotice } from "./NewPostsNotice";
import { listPosts, checkPosts } from "@/lib/posts";
import { useFeedViewer } from "./FeedCacheProvider";
import { useStores, useMascot } from "@/stores/StoreProvider";
import { usePostCache } from "@/hooks/usePostCache";
import { FeedMasonry } from "./FeedMasonry";
import { FeedSkeleton } from "./FeedSkeleton";
import { FeedStatus } from "./FeedStatus";
import { PostCard } from "@/components/posts/PostCard";
import { FeedPagination } from "./FeedPagination";
import { FeedSortTabs } from "./FeedSortTabs";
function Content() {
  const q = useSearchParams(),
    router = useRouter(),
    viewer = useFeedViewer(),
    sort = q.get("sort") === "hot" ? "hot" : "new",
    page = /^[1-9]\d*$/.test(q.get("page") || "")
      ? Math.min(100000, Number(q.get("page")))
      : 1,
    patch = usePostCache(),
    stores = useStores(),
    setMood = useMascot((s) => s.setMood);
  const session = useSWR(
    JSON.stringify(["feed-session", viewer, sort]),
    () => listPosts({ sort, page: 1, limit: 9 }),
    { revalidateOnFocus: false, revalidateIfStale: false },
  );
  const key = session.data
    ? JSON.stringify([
        "feed-page",
        viewer,
        sort,
        page,
        session.data.snapshotId || session.data.cutoff,
      ])
    : null;
  const swr = useSWR(
    key,
    () =>
      page === 1
        ? Promise.resolve(session.data!)
        : listPosts({
            sort,
            page,
            limit: 9,
            snapshot: session.data?.snapshotId,
          }),
    { revalidateOnFocus: false, keepPreviousData: true },
  );
  const data = swr.data || (page === 1 ? session.data : undefined),
    error = swr.error || session.error,
    restored = useRef(""),
    end = useRef<HTMLDivElement>(null);
  const [newCount, setNewCount] = useState(0),
    [checking, setChecking] = useState(false);
  const cutoff = session.data?.cutoff;
  useEffect(() => {
    if (!cutoff) return;
    let active = true;
    const timer = setInterval(() => {
      if (document.hidden) return;
      void checkPosts(cutoff)
        .then((r) => {
          if (active) setNewCount(r.count);
        })
        .catch(() => {});
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [cutoff]);
  async function acceptNew() {
    setChecking(true);
    try {
      await session.mutate();
      setNewCount(0);
      router.replace(`/feed?sort=${sort}&page=1`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "instant" });
    } finally {
      setChecking(false);
    }
  }
  const total =
    data?.totalPages ??
    Math.max(1, Math.ceil((data?.totalCount ?? data?.posts.length ?? 0) / 9));
  useEffect(() => {
    if (data && !swr.isValidating && page > total) {
      router.replace(`/feed?sort=${sort}&page=${total}`, { scroll: false });
    }
  }, [data, swr.isValidating, page, total, sort, router]);
  useEffect(() => {
    if (!data || !data.posts) return;
    const back = stores.feed.getState().detailReturn;
    if (
      back?.sort === sort &&
      back.pages === page &&
      restored.current !== key
    ) {
      restored.current = key || "";
      requestAnimationFrame(() => {
        window.scrollTo({ top: back.y, behavior: "instant" });
        stores.feed.getState().consumeDetailReturn();
      });
    }
  }, [data, key, page, sort, stores]);
  useEffect(() => {
    const node = end.current;
    if (!node || page !== total || !data?.posts.length) return;
    let done = false;
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done) {
        done = true;
        setMood("pout");
      }
    });
    o.observe(node);
    return () => o.disconnect();
  }, [page, total, data?.posts.length, setMood]);
  async function retry(){const fresh=await session.mutate();if(fresh && page===1)await swr.mutate(fresh,{revalidate:false});}
  function change(n: number) {
    router.push(`/feed?sort=${sort}&page=${n}`, { scroll: false });
    document
      .getElementById("feed-list")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  return (
    <section className="feed-page">
      <header className="feed-heading">
        <h1>The feed.</h1>
        <p>Someone made this instead of doing their homework.</p>
      </header>
      <FeedSortTabs sort={sort} />
      <NewPostsNotice
        count={newCount}
        busy={checking}
        onClick={() => void acceptNew()}
      />
      {data?.mode === "mock" && (
        <p className="comic-label">
          Preview data · No production posts or votes are changed
        </p>
      )}
      <div id="feed-list" className="feed-list-anchor">
        {!data && !error ? (
          <FeedSkeleton count={9} />
        ) : (
          <FeedMasonry>
            {data?.posts.map((post, i) => (
              <div className="feed-grid-item" key={post.id}>
                <PostCard
                  post={post}
                  rank={sort === "hot" ? (page - 1) * 9 + i + 1 : undefined}
                  viewerId={viewer}
                  onUpdate={(change) => patch(post, change)}
                  onOpen={() =>
                    stores.feed
                      .getState()
                      .markDetailEntry(
                        `/feed?sort=${sort}&page=${page}`,
                        window.scrollY,
                        page,
                        sort,
                      )
                  }
                />
              </div>
            ))}
          </FeedMasonry>
        )}
      </div>
      {error && (
        <FeedStatus
          kind="error"
          message={error.message}
          onRetry={() => void retry()}
        />
      )}{" "}
      {data && !data.posts.length && !error && <FeedStatus kind="empty" />}
      <FeedPagination page={page} total={total} onPage={change} />
      <div ref={end}>
        {data?.posts.length && page === total ? (
          <FeedStatus kind="end" />
        ) : null}
      </div>
    </section>
  );
}
export function Feed() {
  return (
    <Suspense fallback={<FeedSkeleton count={9} />}>
      <Content />
    </Suspense>
  );
}
