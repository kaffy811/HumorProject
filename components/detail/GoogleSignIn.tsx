"use client";
import { useState } from "react";
import { googleSignInUrl } from "@/lib/start-google-sign-in";
export function GoogleSignIn({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function login() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const url = await googleSignInUrl(
        returnTo + (location.hash === "#comments" && !returnTo.includes("#") ? "#comments" : ""),
      );
      window.location.assign(url);
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
