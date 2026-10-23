"use client";
import { usePostCache } from "@/hooks/usePostCache";
import type { Post } from "@/lib/post-contracts";
import { PostReactions } from "@/components/posts/PostReactions";
export function RankHa({ post }: { post: Post }) {
  const update = usePostCache();
  return <PostReactions post={post} placement="rank" onUpdate={change => update(post, change)} />;
}
