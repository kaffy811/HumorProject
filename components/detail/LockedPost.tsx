/* eslint-disable @next/next/no-img-element */
import { GoogleSignIn } from "./GoogleSignIn";
export function LockedPost({
  post,
}: {
  post: {
    id: string;
    caption: string;
    thumbnailUrl: string;
    authorName: string;
  };
}) {
  return (
    <section className="locked-post-page member-page">
      <div className="locked-post">
        <div className="comic-card locked-card" aria-hidden="true">
          <p className="comic-label">The Humor Project</p>
          <h2>{post.caption}</h2>
          <img src={post.thumbnailUrl} alt="" width={48} height={48} />
        </div>
        <div className="comic-card locked-panel">
          <span className="comic-label">A LITTLE INTRODUCTION FIRST</span>
          <h1>
            Members only.
            <br />
            The membership is free.
          </h1>
          <p>One click. Then the questionable jokes.</p>
          <GoogleSignIn returnTo={`/post/${post.id}`} />
        </div>
      </div>
    </section>
  );
}
