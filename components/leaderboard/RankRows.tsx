/* eslint-disable @next/next/no-img-element -- Private thumbnail endpoints. */
"use client";
import Link from "next/link";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import type { RankedPost, RankedPerson } from "@/lib/leaderboard-contracts";
import { RankHa } from "./RankHa";
import { RankAvatar } from "./RankAvatar";
export function JokeRankRow({ post }: { post: RankedPost }) {
  const own = post.author.id === useFeedViewer();
  return (
    <li
      value={post.rank}
      className={`leaderboard-row ${own ? "is-own" : ""}`}
      data-standing-post={post.id}
    >
      <Link className="rank-row-main" href={`/post/${post.id}`}>
        <img
          className="rank-thumbnail"
          src={post.imageUrl}
          alt={post.caption}
          width={64}
          height={64}
          loading="lazy"
        />
        <div className="rank-copy">
          <strong>{post.caption}</strong>
          <span className="rank-meta">
            {post.author.name}
          </span>
        </div>
      </Link>
      <div className="rank-score">
        <strong>{post.haCount}</strong>
        <RankHa post={post} />
      </div>
    </li>
  );
}
export function PeopleRankRow({ person }: { person: RankedPerson }) {
  const own = person.user.id === useFeedViewer();
  return (
    <li
      value={person.rank}
      className={`leaderboard-row ${own ? "is-own" : ""}`}
      data-standing-user={person.user.id}
    >
      <Link className="rank-row-main" href={`/u/${person.user.id}`}>
        <RankAvatar name={person.user.name} src={person.user.avatarUrl} />
        <div className="rank-copy">
          <strong>{person.user.name}</strong>
          <span className="rank-meta">{person.postCount} posts</span>
          <span className="rank-best-line">{person.bestPost.caption}</span>
        </div>
      </Link>
      <div className="rank-score">
        <strong>{person.haReceived}</strong>
        <span className="comic-label">Likes</span>
      </div>
    </li>
  );
}
