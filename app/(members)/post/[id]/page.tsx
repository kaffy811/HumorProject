import type { Metadata } from "next";
import { headers } from "next/headers";
import { memberAuth } from "@/lib/member-auth";
import { publicPost, lockedPost, excerpt } from "@/lib/post-public";
import { LockedPost } from "@/components/detail/LockedPost";
import { MissingPost } from "@/components/detail/MissingPost";
import { PostDetail } from "@/components/detail/PostDetail";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params,
    p = await publicPost(id);
  if (!p)
    return {
      title: "This joke didn't make it.",
      robots: { index: false, follow: false },
    };
  const h = await headers(),
    host = h.get("host") || "humor-project-lac.vercel.app",
    origin = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
  const title = excerpt(p.caption, 60),
    description = `by ${p.authorName} · The Humor Project`,
    image = `${origin}/post/${id}/opengraph-image`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `${origin}/post/${id}`,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    { user } = await memberAuth();
  if (!user) {
    const post = await lockedPost(id);
    return post ? <LockedPost post={post} /> : <MissingPost />;
  }
  return <PostDetail id={id} />;
}
