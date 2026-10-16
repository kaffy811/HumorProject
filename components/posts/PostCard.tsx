/* eslint-disable @next/next/no-img-element -- Private Storage and blob previews require direct image rendering. */
"use client";
import Link from "next/link";
import { usePublicAuthor } from "@/stores/author-store";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { useEffect, useRef, useState } from "react";
import type { Author, JokeStyle } from "@/lib/create-contracts";
import { relativeTime, type Post } from "@/lib/post-contracts";
import { PostActions } from "./PostActions";
import { PostShare } from "./PostShare";
import { PostMenu } from "./PostMenu";
type Props =
  | {
      preview: true;
      imageUrl: string;
      caption: string;
      author: Author;
      style?: JokeStyle | "HANDMADE";
      imageWidth?: number;
      imageHeight?: number;
    }
  | {
      preview?: false;
      rank?:number;
      variant?: "feed" | "detail" | "leaderboard";
      onComment?: () => void;
      onOpen?: () => void;
      post: Post;
      viewerId: string;
      onUpdate: (change: Partial<Post> | null) => Promise<void>;
    };
export function PostCard(props: Props) {
  const preview = props.preview === true,
    basePost: Post = preview
      ? {
          id: "preview",
          imageUrl: props.imageUrl,
          caption: props.caption || "A punchline goes here. No pressure.",
          imageWidth: props.imageWidth || 1,
          imageHeight: props.imageHeight || 1,
          style: props.style || "Deadpan",
          author: {
            id: "",
            name: props.author.name,
            avatarUrl: props.author.avatarUrl,
          },
          createdAt: "",
          haCount: 0,
          commentCount: 0,
          viewerHasHa: false,
          viewerHasSaved: false,
        }
      : props.post;
  const viewer = useFeedViewer();
  const resolved = usePublicAuthor({
    ...basePost.author,
    id: preview ? viewer : basePost.author.id,
  });
  const post = { ...basePost, author: resolved };
  const card = useRef<HTMLDivElement>(null),
    [failed, setFailed] = useState(false),
    [avatarFailed, setAvatarFailed] = useState<string | null>(null),
    [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (preview) return;
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [preview]);
  const detail = !preview && props.variant === "detail";
  const caption = <p className="post-caption">{post.caption}</p>;
  const image = failed ? (
    <span className="post-image-error">The photo stepped out.</span>
  ) : (
    <img
      className="post-image"
      src={post.imageUrl}
      alt={post.caption}
      width={post.imageWidth}
      height={post.imageHeight}
      loading={preview ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
  return (
    <div
      ref={card}
      className={`comic-card post-card ${preview ? "is-preview" : ""} ${detail ? "is-detail" : ""} ${!preview && props.variant === "leaderboard" ? "is-leaderboard" : ""}`}
    >
      <div className="post-head">
        {!preview && props.rank && <span className="post-feed-rank comic-label">#{props.rank}</span>}
        <div className="post-author">
          {post.author.avatarUrl && avatarFailed !== post.author.avatarUrl ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              width={32}
              height={32}
              loading={preview ? "eager" : "lazy"}
              onError={() => setAvatarFailed(post.author.avatarUrl)}
            />
          ) : (
            <span className="post-author-placeholder" aria-hidden="true">
              {post.author.name.replace(/^@/, "").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>
              <span className="post-author-name">{post.author.name}</span>{" "}
              {post.author.isOfficial && (
                <span className="host-label comic-label">HOST</span>
              )}
            </strong>
            {!preview && <div className="post-meta">
                  <time
                    dateTime={post.createdAt}
                    title={new Date(post.createdAt).toLocaleString()}
                  >
                    {relativeTime(post.createdAt, clock)}
                  </time>
            </div>}
          </div>
        </div>
        {!preview && <PostShare id={post.id} card={card} />}
        {!preview && (
          <PostMenu
            post={post}
            own={post.author.id === props.viewerId}
            onDelete={() => props.onUpdate(null)}
          />
        )}
      </div>
      {preview || detail ? (
        caption
      ) : (
        <Link
          className="post-caption-link"
          href={`/post/${post.id}`}
          onClick={props.preview ? undefined : props.onOpen}
        >
          {caption}
        </Link>
      )}
      <div
        className="post-image-frame"
        style={{
          aspectRatio: detail
            ? post.imageWidth / post.imageHeight
            : 1,
          ...(detail
            ? { maxWidth: `${(70 * post.imageWidth) / post.imageHeight}vh` }
            : {}),
        }}
      >
        {preview || detail ? (
          image
        ) : (
          <Link
            className="post-image-link"
            onClick={props.preview ? undefined : props.onOpen}
            href={`/post/${post.id}`}
            aria-label={`View post: ${post.caption}`}
          >
            {image}
          </Link>
        )}
        {!preview && !detail && (
          <PostActions
            post={post}
            onUpdate={props.onUpdate}
            onComment={props.onComment}
            onOpen={props.onOpen}
          />
        )}
      </div>
    </div>
  );
}
