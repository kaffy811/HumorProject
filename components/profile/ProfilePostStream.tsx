"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { listPosts } from "@/lib/posts";
import { listProfilePosts } from "@/lib/profiles";
import type { PostPage } from "@/lib/post-contracts";
import { usePostCache } from "@/hooks/usePostCache";
import { FeedMasonry } from "@/components/feed/FeedMasonry";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { PostCard } from "@/components/posts/PostCard";
export function ProfilePostStream({
  id,
  tab,
  own,
}: {
  id: string;
  tab: "posts" | "saved";
  own: boolean;
}) {
  const viewer = useFeedViewer(),
    patch = usePostCache(),
    sentinel = useRef<HTMLDivElement>(null),
    [retrying, setRetrying] = useState(false),
    [retryError, setRetryError] = useState(""),
    { mutate: cacheMutate } = useSWRConfig();
  const swr = useSWRInfinite<PostPage>(
    (i, prev) =>
      prev && !prev.nextCursor
        ? null
        : JSON.stringify([
            "profile-posts",
            viewer,
            id,
            tab,
            i,
            prev?.nextCursor || null,
          ]),
    async (key) => {
      const [, , id, tab, , cursor] = JSON.parse(key);
      return tab === "saved"
        ? listPosts({ sort: "saved", cursor })
        : listProfilePosts(id, cursor);
    },
    { revalidateFirstPage: false },
  );
  const { isValidating, error, setSize, size } = swr;
  const pages = swr.data || [],
    posts = pages
      .flatMap((p) => p.posts)
      .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i),
    last = pages.at(-1);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isValidating && !error && last?.nextCursor)
          void setSize(size + 1);
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [last?.nextCursor, isValidating, error, setSize, size]);
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setRetryError("");
    try {
      if (swr.error?.status === 410) {
        const fresh =
          tab === "saved"
            ? await listPosts({ sort: "saved" })
            : await listProfilePosts(id);
        await cacheMutate(
          JSON.stringify(["profile-posts", viewer, id, tab, 0, null]),
          fresh,
          { revalidate: false },
        );
        await swr.mutate([fresh], { revalidate: false });
        await swr.setSize(1);
      } else await swr.mutate();
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Try again.");
    } finally {
      setRetrying(false);
    }
  }
  return (
    <>
      {!swr.data && !swr.error ? (
        <FeedSkeleton count={6} />
      ) : (
        <FeedMasonry>
          {posts.map((post) => (
            <div className="feed-masonry-item" key={post.id}>
              <PostCard
                post={post}
                viewerId={viewer}
                onUpdate={(change) => patch(post, change)}
              />
            </div>
          ))}
        </FeedMasonry>
      )}
      {swr.isValidating && pages.length > 0 && <FeedSkeleton count={3} />}
      <div className="feed-sentinel" ref={sentinel} />
      {swr.error && (
        <div className="feed-status" role="alert">
          <p>{retryError || swr.error.message}</p>
          <button
            className="comic-button"
            disabled={retrying}
            onClick={() => void retry()}
          >
            Retry
          </button>
        </div>
      )}
      {swr.data && !swr.error && !posts.length && (
        <div className="feed-status">
          <p>
            {tab === "saved"
              ? "Nothing saved. Commitment issues?"
              : own
                ? "Nothing yet. The stage is yours."
                : "Quiet one."}
          </p>
          {tab === "posts" && own && (
            <Link className="comic-button is-primary" href="/create">
              Create
            </Link>
          )}
        </div>
      )}
    </>
  );
}
