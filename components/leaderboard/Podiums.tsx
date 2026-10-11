"use client";
import Link from "next/link";
import { PostCard } from "@/components/posts/PostCard";
import { usePostCache } from "@/hooks/usePostCache";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import type { RankedPost, RankedPerson } from "@/lib/leaderboard-contracts";
import { RankAvatar } from "./RankAvatar";
export function JokesPodium({ posts }: { posts: RankedPost[] }) {
  const viewer = useFeedViewer(),
    update = usePostCache();
  return (
    <ol className="leaderboard-podium" aria-label="Top jokes">
      {posts.map((post) => (
        <li
          key={post.id}
          value={post.rank}
          className={`podium-entry podium-rank-${post.rank}`}
          data-standing-post={post.id}
        >
          <span className="podium-number" aria-label={`Rank ${post.rank}`}>
            {post.rank}
          </span>
          <PostCard
            variant="leaderboard"
            post={post}
            viewerId={viewer}
            onUpdate={(change) => update(post, change)}
          />
        </li>
      ))}
    </ol>
  );
}
export function PeoplePodium({ people }: { people: RankedPerson[] }) {
  return (
    <ol className="leaderboard-podium people-podium" aria-label="Top people">
      {people.map((person) => (
        <li
          key={person.user.id}
          value={person.rank}
          className={`podium-entry podium-rank-${person.rank} comic-card person-podium`}
          data-standing-user={person.user.id}
        >
          <span className="podium-number" aria-label={`Rank ${person.rank}`}>
            {person.rank}
          </span>
          <Link href={`/u/${person.user.id}`} className="person-profile">
            <RankAvatar name={person.user.name} src={person.user.avatarUrl} />
            <h2>{person.user.name}</h2>
          </Link>
          <p className="person-ha">
            {person.haReceived} <span>Ha</span>
          </p>
          <p className="comic-label">{person.postCount} posts</p>
          <Link className="person-best" href={`/post/${person.bestPost.id}`}>
            {person.bestPost.caption}
          </Link>
        </li>
      ))}
    </ol>
  );
}
