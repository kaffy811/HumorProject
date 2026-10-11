"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useFeed } from "@/hooks/useFeed";
import { useFeedScroll } from "@/hooks/useFeedScroll";
import { useFeedViewer } from "./FeedCacheProvider";
import { useMascot } from "@/stores/StoreProvider";
import type { PostSort } from "@/lib/post-contracts";
import { FeedSortTabs } from "./FeedSortTabs";
import { FeedMasonry } from "./FeedMasonry";
import { FeedSkeleton } from "./FeedSkeleton";
import { FeedStatus } from "./FeedStatus";
import { NewPostsNotice } from "./NewPostsNotice";
import { PostCard } from "@/components/posts/PostCard";
function Stream({ sort }: { sort: PostSort }) {
  const feed = useFeed(sort),
    viewerId = useFeedViewer(),
    setMood = useMascot((s) => s.setMood),
    sentinel = useRef<HTMLDivElement>(null),
    pouted = useRef(false),
    [busy, setBusy] = useState(false),
    [refreshError, setRefreshError] = useState("");
  useFeedScroll(sort, !!feed.pages.length);
  const { loadMore, ended, loadingMore, error } = feed;
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, loadingMore, error]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !ended || !feed.posts.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !pouted.current) {
        pouted.current = true;
        setMood("pout");
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ended, feed.posts.length, setMood]);
  async function refresh() {
    setBusy(true);
    setRefreshError("");
    try {
      await feed.refresh();
      pouted.current = false;
    } catch (e) {
      setRefreshError(
        e instanceof Error ? e.message : "Could not refresh. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <NewPostsNotice count={feed.newCount} busy={busy} onClick={refresh} />
      {feed.pages[0]?.mode === "mock" && (
        <p className="comic-label">
          Preview data · No public votes or posts are changed
        </p>
      )}
      {feed.checkingError && (
        <p className="feed-small-status" role="status">
          {feed.checkingError}
        </p>
      )}
      {refreshError && (
        <FeedStatus kind="error" message={refreshError} onRetry={refresh} />
      )}{" "}
      {feed.loading ? (
        <FeedSkeleton count={6} />
      ) : (
        <FeedMasonry>
          {feed.posts.map((post) => (
            <div className="feed-masonry-item" key={post.id}>
              <PostCard
                post={post}
                viewerId={viewerId}
                onUpdate={(change) => feed.patch(post, change)}
              />
            </div>
          ))}
        </FeedMasonry>
      )}
      {feed.error && (
        <FeedStatus
          kind="error"
          message={feed.error.message}
          onRetry={() => void feed.retry()}
        />
      )}{" "}
      {feed.loadingMore && feed.pages.length > 0 && <FeedSkeleton count={3} />}
      <div ref={sentinel} className="feed-sentinel" aria-hidden="true" />
      {!feed.loading && !feed.error && !feed.posts.length && (
        <FeedStatus kind="empty" />
      )}
      {feed.ended && feed.posts.length > 0 && <FeedStatus kind="end" />}
    </>
  );
}
function FeedContent() {
  const q = useSearchParams(),
    sort: PostSort = q.get("sort") === "new" ? "new" : "hot";
  return (
    <section className="feed-page">
      <header className="feed-heading">
        <h1>The feed.</h1>
        <p>Someone made this instead of doing their homework.</p>
      </header>
      <FeedSortTabs sort={sort} />
      <Stream key={sort} sort={sort} />
    </section>
  );
}
export function Feed() {
  return (
    <Suspense fallback={<FeedSkeleton count={6} />}>
      <FeedContent />
    </Suspense>
  );
}
