"use client";
import { useCreate } from "@/stores/StoreProvider";
import { selectedCaption } from "@/stores/create-store";
import { ComicButton } from "@/components/ui/ComicButton";
export function PublishPanel({ publish }: { publish: () => void }) {
  const state = useCreate((s) => s),
    selected = selectedCaption(state);
  const busy = state.phase === "publishing",
    done = state.phase === "published";
  return (
    <>
      <p className="publish-copy">
        {done
          ? "Posted. The baby will take the credit."
          : state.mode === "mock"
            ? "This is a demo caption. Publishing stays inside the local demo."
            : "One photo. One punchline. An unreasonable amount of confidence."}
      </p>
      <div className="publish-actions">
        <ComicButton
          disabled={busy || done || !selected?.text.trim()}
          onClick={publish}
        >
          {busy && <span className="loading-mark" aria-hidden="true" />}
          {done
            ? "Posted"
            : busy
              ? "Posting…"
              : state.phase === "publish-error"
                ? "Try posting again"
                : "Post it"}
        </ComicButton>
        <button
          className="text-button"
          disabled={busy || done}
          onClick={() => state.dispatch({ type: "OPEN_STEP", step: 4 })}
        >
          Back to the punchline
        </button>
      </div>
      <div role="status" aria-live="polite">
        {done && <p className="upload-status">Taking you to your post.</p>}
      </div>
    </>
  );
}
