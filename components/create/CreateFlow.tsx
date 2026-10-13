"use client";
import { WelcomeBanner } from "@/components/onboarding/WelcomeBanner";
import { useCreate } from "@/stores/StoreProvider";
import { selectedCaption } from "@/stores/create-store";
import { useCreateController } from "@/hooks/useCreateController";
import { useUnsavedDraftGuard } from "@/hooks/useUnsavedDraftGuard";
import { LeaveDraftDialog } from "@/components/ui/LeaveDraftDialog";
import { ComicButton } from "@/components/ui/ComicButton";
import { StepPanel } from "./StepPanel";
import { ImageUpload } from "./ImageUpload";
import { StylePicker } from "./StylePicker";
import { CaptionCandidates } from "./CaptionCandidates";
import { PublishPanel } from "./PublishPanel";
import type { Author } from "@/lib/create-contracts";
export function CreateFlow({
  author,
  welcome = false,
}: {
  author: Author;
  welcome?: boolean;
}) {
  const state = useCreate((s) => s);
  const actions = useCreateController();
  const guard = useUnsavedDraftGuard();
  const selected = selectedCaption(state);
  const generating = ["generating", "regenerating"].includes(state.phase),
    locked = generating || ["publishing", "published"].includes(state.phase);
  const open = (step: 1 | 2 | 3 | 4 | 5) => () =>
    state.dispatch({ type: "OPEN_STEP", step });
  return (
    <div className="create-page">
      <div className="create-heading">
        <span className="comic-label">The camera roll deserves better</span>
        <h1>Make something funny.</h1>
        <p>
          {welcome
            ? "First one's free. Actually they're all free."
            : "You supply the photo. We supply the questionable judgment."}
        </p>
        <svg className="comic-star" viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M14 0h4v11l8-8 3 3-8 8h11v4H21l8 8-3 3-8-8v11h-4V21l-8 8-3-3 8-8H0v-4h11L3 6l3-3 8 8z"
            fill="currentColor"
          />
        </svg>
      </div>
      {welcome && <WelcomeBanner />}
      <div className="create-steps">
        <StepPanel
          number={1}
          title="The evidence"
          summary={state.image?.filename || "Choose a photo"}
          active={state.step === 1}
          enabled={!locked}
          onOpen={open(1)}
        >
          <ImageUpload {...actions} disabled={locked} />
          {state.phase === "upload-error" && state.error && (
            <p role="alert" className="form-error">
              {state.error}
            </p>
          )}
          {state.image?.uploadId && (
            <ComicButton onClick={open(2)}>Next: the punchline</ComicButton>
          )}
        </StepPanel>
        <StepPanel
          number={2}
          title="Pick your kind of funny"
          summary={state.style}
          active={state.step === 2}
          enabled={!!state.image?.uploadId && !locked}
          onOpen={open(2)}
        >
          <StylePicker generate={actions.generate} disabled={locked} />
        </StepPanel>
        <StepPanel
          number={3}
          title="Let the baby think"
          summary={state.candidates.length ? "Four candidates. One ego." : ""}
          active={state.step === 3}
          enabled={
            !!state.image?.uploadId && !locked && !state.candidates.length
          }
          onOpen={open(3)}
        >
          {generating ? (
            <>
              <p className="generation-status" role="status">
                Thinking. An unfamiliar experience.
              </p>
              {state.retainedCandidate && (
                <p className="generation-status">
                  Your edited caption is being kept.
                </p>
              )}
              <div className="caption-skeletons" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div className="caption-skeleton" key={i}>
                    <div className="skeleton-line" />
                    <div className="skeleton-line" />
                  </div>
                ))}
              </div>
              <ComicButton disabled style={{ marginTop: 18 }}>
                <span className="loading-mark" aria-hidden="true" />
                Making it funny…
              </ComicButton>
            </>
          ) : (
            <>
              <p className="generation-status">
                {state.error || "Ready when your photo is."}
              </p>
              <ComicButton
                disabled={!state.image?.uploadId}
                onClick={actions.generate}
              >
                Try again
              </ComicButton>
            </>
          )}
        </StepPanel>
        <StepPanel
          number={4}
          title="Choose the punchline"
          summary={selected?.text || "Pick one. Make it yours."}
          active={state.step === 4}
          enabled={!!state.candidates.length && !locked}
          onOpen={open(4)}
        >
          {state.mode === "mock" && (
            <p className="comic-label">Demo captions</p>
          )}
          {state.phase === "regeneration-error" && state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
          <CaptionCandidates author={author} generate={actions.generate} />
        </StepPanel>
        <StepPanel
          number={5}
          title="Release it into the world"
          summary={state.phase === "published" ? "Posted" : "Your call."}
          active={state.step === 5}
          enabled={!!selected?.text.trim() && !locked}
          onOpen={open(5)}
        >
          <PublishPanel publish={actions.publish} />
          {state.phase === "publish-error" && state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
        </StepPanel>
      </div>
      <LeaveDraftDialog {...guard} />
    </div>
  );
}
