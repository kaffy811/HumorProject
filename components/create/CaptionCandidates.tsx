"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useCreate } from "@/stores/StoreProvider";
import { characterCount, type Author } from "@/lib/create-contracts";
import { selectedCaption } from "@/stores/create-store";
import { PostCard } from "@/components/posts/PostCard";
import { ComicButton } from "@/components/ui/ComicButton";
export function CaptionCandidates({
  author,
  generate,
}: {
  author: Author;
  generate: () => void;
}) {
  const state = useCreate((s) => s);
  const reduced = useReducedMotion();
  const selected = selectedCaption(state);
  const all = [
    ...(state.retainedCandidate ? [state.retainedCandidate] : []),
    ...state.candidates.filter((c) => c.id !== state.retainedCandidate?.id),
  ];
  return (
    <>
      <div className="candidate-layout">
        <div className="candidate-list">
          {all.map((candidate, index) => (
            <motion.div
              key={candidate.id}
              className={`caption-option ${state.selectedId === candidate.id ? "is-selected" : ""}`}
              initial={reduced ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: reduced ? 0 : index * 0.07 }}
            >
              <label className="candidate-select">
                <input
                  type="radio"
                  name="caption-choice"
                  checked={state.selectedId === candidate.id}
                  onChange={() =>
                    state.dispatch({ type: "SELECT_CAPTION", id: candidate.id })
                  }
                />
                {candidate.source === "retained"
                  ? "Your edit, kept safe"
                  : `Option ${index + (state.retainedCandidate ? 0 : 1)}`}
              </label>
              {state.selectedId === candidate.id ? (
                <>
                  <textarea
                    aria-label="Edit selected caption"
                    className="candidate-editor"
                    value={candidate.text}
                    onChange={(e) =>
                      state.dispatch({
                        type: "EDIT_CAPTION",
                        id: candidate.id,
                        text: e.target.value,
                      })
                    }
                  />
                  <span className="candidate-count">
                    {200 - characterCount(candidate.text)} characters left
                  </span>
                </>
              ) : (
                <p className="candidate-text">{candidate.text}</p>
              )}
            </motion.div>
          ))}
        </div>
        <aside className="post-preview" aria-label="Final post preview">
          <span className="comic-label">The final cut</span>
          <PostCard
            preview
            style={state.style}
            imageUrl={state.image!.previewUrl}
            caption={selected?.text || ""}
            author={author}
          />
        </aside>
      </div>
      <div className="candidate-actions">
        <ComicButton secondary onClick={generate}>
          Regenerate
        </ComicButton>
        <ComicButton
          disabled={!selected?.text.trim()}
          onClick={() => state.dispatch({ type: "OPEN_STEP", step: 5 })}
        >
          Looks funny enough
        </ComicButton>
      </div>
    </>
  );
}
