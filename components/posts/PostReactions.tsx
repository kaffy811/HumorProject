"use client";
import { useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import type { Post } from "@/lib/post-contracts";
import { nextReaction, type PostReaction } from "@/lib/post-reactions";
import { toggleDislike, toggleHa } from "@/lib/posts";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
import { HeartGlyph } from "./HeartGlyph";
import { BrokenHeartGlyph } from "./BrokenHeartGlyph";

// A post can appear in several cached lists on the same screen.
const pending = new Set<string>();
export function PostReactions({ post, onUpdate, placement = "card" }: {
  post: Post;
  onUpdate: (change: Partial<Post> | null) => Promise<void>;
  placement?: "card" | "rank";
}) {
  const [busy, setBusy] = useState(false);
  const [bursts, setBursts] = useState({ ha: 0, dislike: 0 });
  const likeControls = useAnimationControls(), dislikeControls = useAnimationControls();
  const reduced = useReducedMotion(), { notify } = usePostFeedback();
  async function toggle(kind: PostReaction) {
    if (pending.has(post.id)) return;
    pending.add(post.id);
    setBusy(true);
    const previous = { haCount: post.haCount, viewerHasHa: post.viewerHasHa, viewerHasDisliked: post.viewerHasDisliked };
    const next = nextReaction(previous, kind);
    if (kind === "ha" ? next.viewerHasHa : next.viewerHasDisliked)
      setBursts(value => ({ ...value, [kind]: value[kind] + 1 }));
    if (!reduced) void (kind === "ha" ? likeControls : dislikeControls).start({ scaleY: [1, 0.9, 1], transition: { duration: 0.28 } });
    try {
      await onUpdate(next);
      await onUpdate(await (kind === "ha" ? toggleHa(post.id) : toggleDislike(post.id)));
    } catch (error) {
      await onUpdate(previous);
      notify(error instanceof Error ? error.message : "Your reaction didn’t stick. Try again.");
    } finally {
      pending.delete(post.id);
      setBusy(false);
    }
  }
  const card = placement === "card";
  const buttonClass = placement === "rank" ? "rank-ha" : "post-overlay-button";
  return <div className="post-reactions" data-post-controls onClick={event => event.stopPropagation()}>
    <div className="post-action-group">
      <motion.button type="button" className={`${buttonClass} is-heart ${post.viewerHasHa ? "is-active" : ""}`}
        aria-label={post.viewerHasHa ? "Unlike post" : "Like post"} title={post.viewerHasHa ? "Unlike" : "Like"}
        aria-pressed={post.viewerHasHa} disabled={busy} onClick={() => void toggle("ha")} animate={likeControls}>
        <HeartGlyph active={post.viewerHasHa} burst={bursts.ha} />
        {card && <span className="post-action-count" aria-label={`${post.haCount} likes`}>{post.haCount}</span>}
      </motion.button>
    </div>
    <div className="post-action-group">
      <motion.button type="button" className={`${buttonClass} is-dislike ${post.viewerHasDisliked ? "is-active" : ""}`}
        aria-label={post.viewerHasDisliked ? "Remove dislike" : "Dislike post"} title={post.viewerHasDisliked ? "Remove dislike" : "Dislike"}
        aria-pressed={post.viewerHasDisliked} disabled={busy} onClick={() => void toggle("dislike")} animate={dislikeControls}>
        <BrokenHeartGlyph active={post.viewerHasDisliked} burst={bursts.dislike} />
      </motion.button>
    </div>
  </div>;
}
