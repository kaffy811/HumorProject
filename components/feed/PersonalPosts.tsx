"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useFeed } from "@/hooks/useFeed";
import { useFeedScroll } from "@/hooks/useFeedScroll";
import { useFeedViewer } from "./FeedCacheProvider";
import { FeedMasonry } from "./FeedMasonry";
import { FeedSkeleton } from "./FeedSkeleton";
import { FeedStatus } from "./FeedStatus";
import { PostCard } from "@/components/posts/PostCard";
function PersonalStream({ sort }: { sort: "mine" | "saved" }) {
  const feed = useFeed(sort),
    viewer = useFeedViewer(),
    sentinel = useRef<HTMLDivElement>(null);
  useFeedScroll(sort, !!feed.pages.length);
  const { loadMore, loadingMore, error } = feed;
  useEffect(() => {
    if (!sentinel.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [loadMore, loadingMore, error]);
  return (
    <>
      {feed.loading ? (
        <FeedSkeleton count={6} />
      ) : (
        <FeedMasonry>
          {feed.posts.map((post) => (
            <div className="feed-masonry-item" key={post.id}>
              <PostCard
                post={post}
                viewerId={viewer}
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
      )}
      {feed.loadingMore && feed.pages.length > 0 && <FeedSkeleton count={3} />}
      <div className="feed-sentinel" ref={sentinel} aria-hidden="true" />
      {!feed.loading && !feed.error && !feed.posts.length && (
        <div className="feed-status">
          <p>
            {sort === "saved"
              ? "Nothing saved. Your standards remain a mystery."
              : "Nothing posted. Your reputation is still intact."}
          </p>
          <Link
            className="comic-button"
            href={sort === "saved" ? "/feed" : "/create"}
          >
            {sort === "saved" ? "Find something funny" : "Create"}
          </Link>
        </div>
      )}
      {feed.ended && !!feed.posts.length && (
        <p className="personal-end">
          {sort === "saved"
            ? "Your private collection. Questionable taste included."
            : "That's your contribution so far."}
        </p>
      )}
    </>
  );
}
function PersonalContent() {
  const q = useSearchParams(),
    sort = q.get("tab") === "saved" ? "saved" : "mine";
  return (
    <section className="feed-page">
      <header className="feed-heading">
        <h1>Your corner.</h1>
        <p>A little evidence of your sense of humor.</p>
      </header>
      <div className="feed-sort" aria-label="Your posts">
        <button
          className={`style-option ${sort === "mine" ? "is-selected" : ""}`}
          aria-pressed={sort === "mine"}
          onClick={() => window.history.replaceState(null, "", "/me")}
        >
          My posts
        </button>
        <button
          className={`style-option ${sort === "saved" ? "is-selected" : ""}`}
          aria-pressed={sort === "saved"}
          onClick={() => window.history.replaceState(null, "", "/me?tab=saved")}
        >
          Saved
        </button>
      </div>
      <PersonalStream key={sort} sort={sort} />
    </section>
  );
}
export function PersonalPosts() {
  return (
    <Suspense fallback={<FeedSkeleton count={6} />}>
      <PersonalContent />
    </Suspense>
  );
}
