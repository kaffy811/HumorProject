"use client";
import { useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { toggleHa } from "@/lib/posts";
import { usePostCache } from "@/hooks/usePostCache";
import { usePostFeedback } from "@/components/feed/FeedCacheProvider";
import type { Post } from "@/lib/post-contracts";
import { HeartGlyph } from "@/components/posts/HeartGlyph";
export function RankHa({ post }: { post: Post }) {
  const locked = useRef(false),
    [busy, setBusy] = useState(false),
    [burst, setBurst] = useState(0),
    controls = useAnimationControls(),
    reduced = useReducedMotion(),
    update = usePostCache(),
    { notify } = usePostFeedback();
  async function click() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    if (!post.viewerHasHa) setBurst(n => n + 1);
    const previous = { haCount: post.haCount, viewerHasHa: post.viewerHasHa };
    if (!reduced)
      void controls.start({
        scaleY: [1, 0.9, 1],
        transition: { duration: 0.28 },
      });
    try {
      await update(post, {
        haCount: Math.max(0, post.haCount + (post.viewerHasHa ? -1 : 1)),
        viewerHasHa: !post.viewerHasHa,
      });
      await update(post, await toggleHa(post.id));
    } catch (e) {
      await update(post, previous);
      notify(
        e instanceof Error ? e.message : "Your like didn’t stick. Try again.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <motion.button
      className={`rank-ha ${post.viewerHasHa ? "is-active" : ""}`}
      aria-label={`${post.viewerHasHa ? "Unlike" : "Like"} post: ${post.caption}`}
      aria-pressed={post.viewerHasHa}
      animate={controls}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        void click();
      }}
    >
      <HeartGlyph active={post.viewerHasHa} burst={burst} />
    </motion.button>
  );
}
