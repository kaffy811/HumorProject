"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function GoogleSignIn({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function login() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await fetch("/auth/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: returnTo + (location.hash === "#comments" ? "#comments" : ""),
        }),
      });
      if (!saved.ok) throw new Error("Could not prepare sign-in. Try again.");
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url)
        throw new Error("Google sign-in did not finish. Try again.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in stumbled. Try again.");
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="comic-button"
        disabled={busy}
        onClick={() => void login()}
      >
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
