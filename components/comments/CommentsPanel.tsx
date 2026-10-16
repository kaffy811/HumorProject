"use client";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { profileRequest } from "@/lib/profiles";
import { validUuid } from "@/lib/create-contracts";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { Post } from "@/lib/post-contracts";
import type { Comment, CommentSort } from "@/lib/comment-contracts";
import { useComments } from "@/hooks/useComments";
import { useCommentThreads } from "@/hooks/useCommentThreads";
import type { CommentThread } from "@/lib/comment-threads";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
import { PostActions } from "@/components/posts/PostActions";
import { usePostCache } from "@/hooks/usePostCache";
import { COMMENT_DEPTH_ERROR, MAX_COMMENT_DEPTH } from "@/lib/comment-contracts";
export function CommentsPanel({
  post,
  viewerId,
  input,
}: {
  post: Post;
  viewerId: string;
  input: RefObject<HTMLTextAreaElement | null>;
}) {
  const panel = useRef<HTMLElement>(null);
  const patchPost = usePostCache();
  const params = useSearchParams(),
    targetId = params.get("comment");
  const target = useSWR(
    validUuid(targetId)
      ? JSON.stringify(["comment-target", viewerId, post.id, targetId])
      : null,
    () =>
      profileRequest<Comment>(`/api/comments/${targetId}?postId=${post.id}`),
  );
  const targetScrolled = useRef<string | null>(null);
  const [sort, setSort] = useState<CommentSort>("top"),
    [reply, setReply] = useState<Comment | null>(null),
    comments = useComments(post, sort),
    { notify } = usePostFeedback();
  const visibleComments = [
    ...(target.data && !comments.comments.some(c => c.id === target.data!.id) ? [target.data] : []),
    ...comments.comments,
  ];
  const conversations = useCommentThreads(visibleComments,viewerId,post.id,sort,comments.highlighted);
  useEffect(() => {
    if (!target.data || conversations.parentsLoading || targetScrolled.current === target.data.id) return;
    targetScrolled.current = target.data.id;
    document.getElementById(`comment-${target.data.id}`)?.scrollIntoView({ block: "center", behavior: "instant" });
    input.current?.focus({ preventScroll: true });
  }, [target.data, conversations.parentsLoading, input]);
  function renderThread(thread: CommentThread, level = 1): React.ReactNode {
    const c = thread.comment;
    return <li key={c.id} className="comment-thread" data-thread-level={Math.min(level, 3)}>
      <CommentItem
        comment={{ ...c, depth: c.depth || level }} parent={thread.parent} viewerId={viewerId} op={post.author.id}
        highlighted={comments.highlighted.has(c.id) || c.id === target.data?.id}
        onReply={() => {
          if (Math.max(c.depth || level, level) >= MAX_COMMENT_DEPTH) {
            notify(COMMENT_DEPTH_ERROR);
            return;
          }
          if (conversations.parentsLoading) {
            notify("Replies are still loading. Try again in a moment.");
            return;
          }
          setReply({ ...c, depth: c.depth || level }); input.current?.focus();
        }}
        onDelete={async () => { await comments.remove(c); if(reply?.id === c.id) setReply(null); }}
        onPatch={change => comments.patch(c.id,change)}
      />
      {!!thread.replies.length && <ul className="comment-replies" aria-label={`Replies to ${c.author.name}`}>{thread.replies.map(child => renderThread(child, level + 1))}</ul>}
    </li>;
  }
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = panel.current;
      if (!element || innerWidth < 1024) return;
      // The back link puts the initial panel below its eventual sticky offset.
      // Reserve that actual offset so the composer stays inside the viewport.
      const top = Math.max(122, element.getBoundingClientRect().top);
      element.style.setProperty("--comments-top", `${top}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return (
    <section
      ref={panel}
      id="comments"
      className={`comments-panel ${!comments.loading&&!comments.comments.length?"is-empty":""}`}
      aria-labelledby="comments-title"
    >
      <PostActions post={post} placement="comments" onUpdate={change => patchPost(post, change)} />
      <header className="comments-heading">
        <h2 id="comments-title">
          Comments <span>{post.commentCount}</span>
        </h2>
        <div className="comment-sort" role="group" aria-label="Sort comments">
          {(["top", "new"] as const).map((s) => (
            <button
              key={s}
              className={`comic-tag ${sort === s ? "is-selected" : ""}`}
              aria-pressed={sort === s}
              onClick={() => setSort(s)}
            >
              {s === "top" ? "Top" : "New"}
            </button>
          ))}
        </div>
      </header>
      <div className="comments-scroll">
        <span className="sr-only" role="status" aria-live="polite">
          {comments.announcement}
        </span>
        <ul className="comment-list">
          {conversations.threads.map(thread => renderThread(thread))}
        </ul>
        {conversations.parentError && <p className="comments-error" role="alert">Some replies could not be grouped. <button className="text-button" onClick={() => void conversations.retryParents().catch(() => {})}>Retry</button></p>}
        {comments.loading && (
          <div aria-label="Loading comments" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div className="comment-skeleton" key={i} />
            ))}
          </div>
        )}
        {!comments.loading && !comments.error && !comments.comments.length && (
          <p className="comments-empty">
            No comments yet. The silence is deafening.
          </p>
        )}
        {comments.error && (
          <div className="comments-error" role="alert">
            <p>
              {comments.error instanceof Error
                ? comments.error.message
                : "The comments stumbled. Try again."}
            </p>
            <button
              className="comic-button is-secondary"
              onClick={() =>
                void comments
                  .retry()
                  .catch((e) =>
                    notify(
                      e instanceof Error
                        ? e.message
                        : "Could not load comments. Try again.",
                    ),
                  )
              }
            >
              Retry
            </button>
          </div>
        )}
        {comments.nextCursor && !comments.error && (
          <button
            className="comic-button is-secondary comment-load-more"
            disabled={comments.loadingMore}
            onClick={() => void comments.loadMore()}
          >
            {comments.loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
      <CommentComposer
        input={input}
        reply={reply}
        onCancel={() => setReply(null)}
        onRestoreReply={(previous) =>
          setReply((current) => current || previous)
        }
        busy={comments.busy}
        onSend={comments.send}
      />
    </section>
  );
}
