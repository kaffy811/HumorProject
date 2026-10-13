"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { skipOnboarding } from "@/lib/onboarding";
export function WelcomeBanner() {
  const [closed, setClosed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    router = useRouter();
  return (
    <>
      {!closed && (
        <aside className="welcome-banner">
          <div>
            <strong>Three steps. A suspicious amount of confidence.</strong>
            <p>Upload a photo. Pick a punchline. Post it.</p>
          </div>
          <button
            className="icon-button"
            aria-label="Dismiss welcome tip"
            onClick={() => setClosed(true)}
          >
            ×
          </button>
        </aside>
      )}
      <div className="welcome-skip">
        <button
          className="text-link"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await skipOnboarding();
              router.replace("/feed");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Try again.");
              setBusy(false);
            }
          }}
        >
          {busy ? "Skipping…" : "Skip for now"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </>
  );
}
