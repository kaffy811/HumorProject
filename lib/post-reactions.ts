import type { Post } from "./post-contracts";

export type PostReaction = "ha" | "dislike";
export type ReactionState = Pick<Post, "haCount" | "viewerHasHa" | "viewerHasDisliked">;

export function nextReaction(post: ReactionState, kind: PostReaction): ReactionState {
  const liked = kind === "ha" && !post.viewerHasHa;
  const disliked = kind === "dislike" && !post.viewerHasDisliked;
  return {
    viewerHasHa: liked,
    viewerHasDisliked: disliked,
    haCount: Math.max(0, post.haCount + Number(liked) - Number(post.viewerHasHa)),
  };
}
