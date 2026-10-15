import Link from "next/link";
export default function PrivacyPage() {
  return (
    <section className="member-shell member-page privacy-page">
      <span className="eyebrow">A LITTLE CLARITY</span>
      <h1>Your photos. Your choice.</h1>
      <p>
        This is an independent student project. Supabase stores authentication,
        profiles, photos, captions, generation prompts and reactions.
      </p>
      <p>
        Generating captions sends your selected photo and direction to Google
        Gemini. Only upload photos you have permission to share. Members can
        read full posts. Public share previews include a shortened caption and a
        composited image.
      </p>
      <p>
        Your @username and optional avatar appear with posts and comments. First
        and last names appear on your member profile. Saved posts and your vote
        history are visible only to you. Generation prompts are stored privately
        on the server.
      </p>
      <p>
        Images live in private file storage. Google sign-in requests basic
        account information. You can edit your profile, delete your own posts or
        sign out from the account menu. API credentials stay on the server.
      </p>
      <Link className="text-link" href="/">
        Back to The Humor Project ↗
      </Link>
    </section>
  );
}
