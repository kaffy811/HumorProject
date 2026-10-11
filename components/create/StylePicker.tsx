"use client";
import { useCreate } from "@/stores/StoreProvider";
import { characterCount, STYLES } from "@/lib/create-contracts";
import { ComicButton } from "@/components/ui/ComicButton";
export function StylePicker({
  generate,
  disabled,
}: {
  generate: () => void;
  disabled: boolean;
}) {
  const style = useCreate((s) => s.style),
    context = useCreate((s) => s.context),
    dispatch = useCreate((s) => s.dispatch),
    image = useCreate((s) => s.image);
  return (
    <>
      <div className="style-options" role="group" aria-label="Joke style">
        {STYLES.map((value) => (
          <button
            type="button"
            disabled={disabled}
            key={value}
            className={`style-option ${style === value ? "is-selected" : ""}`}
            aria-pressed={style === value}
            onClick={() => dispatch({ type: "SET_STYLE", style: value })}
          >
            {value}
          </button>
        ))}
      </div>
      <label className="input-label" htmlFor="joke-context">
        A little direction, if you must.
      </label>
      <input
        id="joke-context"
        className="comic-input"
        placeholder="Anything specific? (optional)"
        value={context}
        disabled={disabled}
        onChange={(e) =>
          dispatch({ type: "SET_CONTEXT", text: e.target.value })
        }
        aria-describedby="context-count"
      />
      <div className="input-meta">
        <span>Optional. The baby prefers creative freedom.</span>
        <span id="context-count">{characterCount(context)}/120</span>
      </div>
      <ComicButton disabled={disabled || !image?.uploadId} onClick={generate}>
        Make it funny
      </ComicButton>
    </>
  );
}
