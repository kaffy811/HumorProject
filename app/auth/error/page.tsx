import { cookies } from "next/headers";
import { GoogleSignIn } from "@/components/detail/GoogleSignIn";
import { RETURN_COOKIE, safeReturnPath } from "@/lib/auth-return";

export const dynamic = "force-dynamic";

export default async function SignInError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const jar = await cookies();
  const returnTo = safeReturnPath(jar.get(RETURN_COOKIE)?.value) || "/feed";
  return (
    <div className="member-shell">
      <main className="member-content">
        <section className="member-page">
          <span className="comic-label">One small interruption</span>
          <h1>Let&apos;s finish signing you in.</h1>
          <div className="comic-card" style={{ padding: 24, marginTop: 24 }}>
            <p role="alert">
              {reason === "profile"
                ? "Your profile could not be loaded. Retry to continue."
                : reason === "unavailable"
                  ? "The connection stumbled. Retry to continue."
                  : "Google sign-in could not be completed. Try again in this browser."}
            </p>
            <div className="post-dialog-actions">
              <a className="comic-button is-secondary" href="/auth/continue">
                Retry connection
              </a>
              <GoogleSignIn returnTo={returnTo} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
