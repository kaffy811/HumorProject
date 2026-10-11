"use client";
import useSWR from "swr";
import type { Post } from "@/lib/post-contracts";
import { listPosts } from "@/lib/posts";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { usePostCache } from "@/hooks/usePostCache";
import { PostCard } from "@/components/posts/PostCard";
export function KeepGoing({ id }: { id: string }) {
  const viewer = useFeedViewer(),
    patch = usePostCache();
  const { data } = useSWR(
    JSON.stringify(["recommendations", viewer, id]),
    async () => {
      const posts: Post[] = [];
      let cursor: string | null = null,
        first = true;
      while (posts.length < 3 && (first || cursor)) {
        first = false;
        const page = await listPosts({ sort: "hot", cursor, limit: 12 });
        posts.push(
          ...page.posts
            .filter((p) => p.id !== id && !posts.some((x) => x.id === p.id))
            .slice(0, 3 - posts.length),
        );
        cursor = page.nextCursor;
      }
      return {
        posts,
        nextCursor: null,
        cutoff: new Date().toISOString(),
        mode: "live" as const,
      };
    },
  );
  if (!data?.posts.length) return null;
  return (
    <section className="keep-going" aria-labelledby="keep-going-title">
      <h2 id="keep-going-title">Keep going</h2>
      <div className="keep-going-cards">
        {data.posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            viewerId={viewer}
            onUpdate={(change) => patch(p, change)}
          />
        ))}
      </div>
    </section>
  );
}
