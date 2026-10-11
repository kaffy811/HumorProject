"use client";
import { useState, type RefObject } from "react";
import type { Post } from "@/lib/post-contracts";
import type { Comment, CommentSort } from "@/lib/comment-contracts";
import { useComments } from "@/hooks/useComments";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
export function CommentsPanel({
  post,
  viewerId,
  input,
}: {
  post: Post;
  viewerId: string;
  input: RefObject<HTMLTextAreaElement | null>;
}) {
  const [sort, setSort] = useState<CommentSort>("top"),
    [reply, setReply] = useState<Comment | null>(null),
    comments = useComments(post, sort),
    { notify } = usePostFeedback();
  return (
    <section
      id="comments"
      className="comments-panel"
      aria-labelledby="comments-title"
    >
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
          {comments.comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              viewerId={viewerId}
              op={post.author.id}
              highlighted={comments.highlighted.has(c.id)}
              onReply={() => {
                setReply(c);
                input.current?.focus();
              }}
              onDelete={async () => {
                await comments.remove(c);
                if (reply?.id === c.id) setReply(null);
              }}
              onPatch={(change) => comments.patch(c.id, change)}
            />
          ))}
        </ul>
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
