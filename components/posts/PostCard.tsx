/* eslint-disable @next/next/no-img-element -- Private Storage and blob previews require direct image rendering. */
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Author, JokeStyle } from "@/lib/create-contracts";
import { imageRatio, relativeTime, type Post } from "@/lib/post-contracts";
import { PostActions } from "./PostActions";
import { PostMenu } from "./PostMenu";
type Props =
  | {
      preview: true;
      imageUrl: string;
      caption: string;
      author: Author;
      style?: JokeStyle;
      imageWidth?: number;
      imageHeight?: number;
    }
  | {
      preview?: false;
      post: Post;
      viewerId: string;
      onUpdate: (change: Partial<Post> | null) => Promise<void>;
    };
export function PostCard(props: Props) {
  const preview = props.preview === true,
    post: Post = preview
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
        }
      : props.post;
  const card = useRef<HTMLDivElement>(null),
    [failed, setFailed] = useState(false),
    [avatarFailed, setAvatarFailed] = useState(false),
    [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (preview) return;
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [preview]);
  const caption = <p className="post-caption">{post.caption}</p>,
    image = (
      <div
        className="post-image-frame"
        style={{ aspectRatio: imageRatio(post.imageWidth, post.imageHeight) }}
      >
        {failed ? (
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
            onLoad={(e) => {
              if (preview) {
                const img = e.currentTarget;
                const frame = img.parentElement!;
                frame.style.aspectRatio = String(
                  imageRatio(img.naturalWidth, img.naturalHeight),
                );
              }
            }}
          />
        )}
      </div>
    );
  return (
    <div
      ref={card}
      className={`comic-card post-card ${preview ? "is-preview" : ""}`}
    >
      <div className="post-head">
        <div className="post-author">
          {post.author.avatarUrl && !avatarFailed ? (
            <img
              src={post.author.avatarUrl}
              alt=""
              width={32}
              height={32}
              loading={preview ? "eager" : "lazy"}
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <span className="post-author-placeholder" aria-hidden="true">
              {post.author.name.slice(0, 1)}
            </span>
          )}
          <div>
            <strong>{post.author.name}</strong>
            {!preview && (
              <time
                dateTime={post.createdAt}
                title={new Date(post.createdAt).toLocaleString()}
              >
                {relativeTime(post.createdAt, clock)}
              </time>
            )}
          </div>
        </div>
        <span className="post-style comic-label">{post.style}</span>
        {!preview && (
          <PostMenu
            post={post}
            own={post.author.id === props.viewerId}
            onDelete={() => props.onUpdate(null)}
          />
        )}
      </div>
      {preview ? (
        caption
      ) : (
        <Link className="post-caption-link" href={`/post/${post.id}`}>
          {caption}
        </Link>
      )}
      {preview ? (
        image
      ) : (
        <Link
          className="post-image-link"
          href={`/post/${post.id}`}
          aria-label={`View post: ${post.caption}`}
        >
          {image}
        </Link>
      )}
      {!preview && (
        <PostActions post={post} card={card} onUpdate={props.onUpdate} />
      )}
    </div>
  );
}
