import type { Post, PostPage } from "./post-contracts";
// Patch every cached ordering, including the aggregate SWR Infinite entry.
// Reinsert on a failed unsave even if the Saved card has already unmounted.
export function patchPostPages(
  pages: PostPage[],
  post: Post,
  change: Partial<Post> | null,
  saved: boolean,
  firstPage: boolean,
) {
  const result = pages.map((page) => ({
    ...page,
    posts: page.posts.flatMap((p) =>
      p.id !== post.id
        ? [p]
        : !change || (saved && change.viewerHasSaved === false)
          ? []
          : [{ ...p, ...change }],
    ),
  }));
  if (
    saved &&
    firstPage &&
    change?.viewerHasSaved === true &&
    result.length &&
    !result.some((page) => page.posts.some((p) => p.id === post.id))
  ) {
    result[0] = {
      ...result[0],
      posts: [{ ...post, ...change }, ...result[0].posts],
    };
  }
  return result;
}
