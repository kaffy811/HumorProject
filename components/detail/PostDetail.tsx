"use client";
import {FirstPostNotice} from "@/components/onboarding/FirstPostNotice";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useStore } from "zustand";
import { getPost } from "@/lib/comments";
import { PostError } from "@/lib/posts";
import { usePostCache } from "@/hooks/usePostCache";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { useStores } from "@/stores/StoreProvider";
import { PostCard } from "@/components/posts/PostCard";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { CommentsPanel } from "@/components/comments/CommentsPanel";
import { MissingPost } from "./MissingPost";
import { KeepGoing } from "./KeepGoing";
export function PostDetail({ id }: { id: string }) {
  const viewer = useFeedViewer(),
    patch = usePostCache(),
    router = useRouter(),
    { feed } = useStores(),
    back = useStore(feed, (s) => s.detailBack),
    input = useRef<HTMLTextAreaElement>(null);
  const {
    data: post,
    error,
    isLoading,
    mutate,
  } = useSWR(JSON.stringify(["post", viewer, id]), () => getPost(id));
  const loadedId = post?.id;
  useEffect(() => {
    if (location.hash !== "#comments")
      window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);
  function focus() {
    const section = document.getElementById("comments");
    section?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches
        ? "instant"
        : "smooth",
    });
    input.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        !document.querySelector("dialog[open]") &&
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.isComposing &&
        !el.closest('input,textarea,select,[contenteditable="true"]') &&
        input.current
      ) {
        e.preventDefault();
        input.current.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, []);
  useEffect(() => {
    if (!loadedId || location.hash !== "#comments") return;
    const timer = setTimeout(() => {
      document
        .getElementById("comments")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
      input.current?.focus({ preventScroll: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [loadedId]);
  if (
    (error instanceof PostError && error.status === 404) ||
    (!isLoading && !error && post === null)
  )
    return <MissingPost />;
  return (
    <section className="post-detail-page">
      {post && <FirstPostNotice postId={post.id} pending={!!post.firstPostPending}/>}
      <Link className="detail-back" href={back || "/feed"} scroll={false}>
        ← Back to the feed
      </Link>
      {isLoading ? (
        <div className="detail-grid">
          <FeedSkeleton count={1} />
          <div aria-label="Loading comments" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div className="comment-skeleton" key={i} />
            ))}
          </div>
        </div>
      ) : error ? (
        <div role="alert">
          <p>{error.message || "The post stumbled. Try again."}</p>
          <button className="comic-button" onClick={() => void mutate()}>
            Retry
          </button>
        </div>
      ) : (
        post && (
          <>
            <div className="detail-grid">
              <div className="detail-left">
                <PostCard
                  variant="detail"
                  post={post}
                  viewerId={viewer}
                  onComment={focus}
                  onUpdate={async (change) => {
                    await patch(post, change);
                    if (change === null) router.replace("/feed");
                  }}
                />
                <KeepGoing id={id} />
              </div>
              <CommentsPanel
                key={post.id}
                post={post}
                viewerId={viewer}
                input={input}
              />
            </div>
          </>
        )
      )}
    </section>
  );
}
