"use client";
import { useCreate } from "@/stores/StoreProvider";
import { characterCount } from "@/lib/create-contracts";
import { ComicButton } from "@/components/ui/ComicButton";
export function WritingMode({
  generate,
  preview,
  disabled,
}: {
  generate: () => void;
  preview: () => void;
  disabled: boolean;
}) {
  const s = useCreate((s) => s);
  return (
    <div id="writing-mode">
      <div className="feed-sort" aria-label="Who writes the caption">
        {(["ai", "handmade"] as const).map((mode) => (
          <button
            key={mode}
            className={`style-option ${s.writingMode === mode ? "is-selected" : ""}`}
            aria-pressed={s.writingMode === mode}
            disabled={disabled}
            onClick={() => s.dispatch({ type: "SET_WRITING_MODE", mode })}
          >
            {mode === "ai" ? "Let the baby write" : "I'll write it"}
          </button>
        ))}
      </div>
      {s.writingMode === "ai" ? (
        <>
          <label className="direction-field">
            <span className="comic-label">A direction, if you have one</span>
            <input
              value={s.context}
              onChange={(e) =>
                s.dispatch({ type: "SET_CONTEXT", text: e.target.value })
              }
              maxLength={120}
              placeholder="Anything specific? (optional)"
              disabled={disabled}
            />
          </label>
          <ComicButton
            data-writing-primary
            disabled={disabled || !s.image?.uploadId}
            onClick={generate}
          >
            Make it funny
          </ComicButton>
        </>
      ) : (
        <>
          <label className="direction-field">
            <span className="comic-label">Your punchline</span>
            <textarea
              value={s.handmadeText}
              onChange={(e) =>
                s.dispatch({ type: "SET_HANDMADE", text: e.target.value })
              }
              placeholder="Prove the baby wrong."
              maxLength={200}
              disabled={disabled}
            />
          </label>
          <span className="candidate-count">
            {200 - characterCount(s.handmadeText)} characters left
          </span>
          <ComicButton
            data-writing-primary
            disabled={disabled || !s.handmadeText.trim() || !s.image?.uploadId}
            onClick={preview}
          >
            Preview
          </ComicButton>
        </>
      )}
    </div>
  );
}
