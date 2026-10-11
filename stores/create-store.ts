import { createStore } from "zustand/vanilla";
import {
  truncate,
  type CaptionCandidate,
  type JokeStyle,
} from "@/lib/create-contracts";
export type CreateStep = 1 | 2 | 3 | 4 | 5;
export type CreatePhase =
  | "empty"
  | "uploading"
  | "upload-error"
  | "configuring"
  | "generating"
  | "generation-error"
  | "editing"
  | "regenerating"
  | "regeneration-error"
  | "publishing"
  | "publish-error"
  | "published";
export interface DraftImage {
  uploadId: string | null;
  previewUrl: string;
  filename: string;
  mimeType: string;
  bytes: number;
}
export interface CreateState {
  draftId: string | null;
  step: CreateStep;
  phase: CreatePhase;
  image: DraftImage | null;
  style: JokeStyle;
  context: string;
  candidates: CaptionCandidate[];
  retainedCandidate: CaptionCandidate | null;
  selectedId: string | null;
  activeRequestId: string | null;
  error: string | null;
  publishedPostId: string | null;
  mode: "live" | "mock";
}
export type CreateEvent =
  | { type: "IMAGE_SELECTED"; image: DraftImage; requestId: string }
  | {
      type: "UPLOAD_READY";
      requestId: string;
      draftId: string;
      uploadId: string;
    }
  | { type: "UPLOAD_FAILED"; requestId: string; message: string }
  | { type: "REMOVE_IMAGE" }
  | { type: "SET_STYLE"; style: JokeStyle }
  | { type: "SET_CONTEXT"; text: string }
  | { type: "OPEN_STEP"; step: CreateStep }
  | { type: "GENERATE_STARTED"; requestId: string }
  | {
      type: "GENERATE_SUCCEEDED";
      requestId: string;
      candidates: CaptionCandidate[];
      mode: "live" | "mock";
    }
  | { type: "GENERATE_FAILED"; requestId: string; message: string }
  | { type: "SELECT_CAPTION"; id: string }
  | { type: "EDIT_CAPTION"; id: string; text: string }
  | { type: "PUBLISH_STARTED"; requestId: string }
  | { type: "PUBLISH_SUCCEEDED"; requestId: string; postId: string }
  | { type: "PUBLISH_FAILED"; requestId: string; message: string }
  | { type: "RESET" };
export interface CreateStore extends CreateState {
  dispatch: (event: CreateEvent) => void;
}
export const initialState: CreateState = {
  draftId: null,
  step: 1,
  phase: "empty",
  image: null,
  style: "Deadpan",
  context: "",
  candidates: [],
  retainedCandidate: null,
  selectedId: null,
  activeRequestId: null,
  error: null,
  publishedPostId: null,
  mode: "live",
};
export function selectedCaption(s: CreateState) {
  return (
    [
      ...s.candidates,
      ...(s.retainedCandidate ? [s.retainedCandidate] : []),
    ].find((c) => c.id === s.selectedId) || null
  );
}
export function hasUnpublishedContent(s: CreateState) {
  return (
    !!(s.candidates.length || s.retainedCandidate || s.phase === "generating" || s.phase === "generation-error") && s.phase !== "published"
  );
}
export function reduceCreate(s: CreateState, event: CreateEvent): CreateState {
  if (
    "requestId" in event &&
    !["IMAGE_SELECTED", "GENERATE_STARTED", "PUBLISH_STARTED"].includes(
      event.type,
    ) &&
    event.requestId !== s.activeRequestId
  )
    return s;
  switch (event.type) {
    case "RESET":
    case "REMOVE_IMAGE":
      return { ...initialState };
    case "IMAGE_SELECTED":
      return {
        ...initialState,
        style: s.style,
        context: s.context,
        image: event.image,
        phase: "uploading",
        activeRequestId: event.requestId,
      };
    case "UPLOAD_READY":
      return {
        ...s,
        draftId: event.draftId,
        image: { ...s.image!, uploadId: event.uploadId },
        phase: "configuring",
        step: 2,
        error: null,
        activeRequestId: null,
      };
    case "UPLOAD_FAILED":
      return {
        ...s,
        phase: "upload-error",
        error: event.message,
        activeRequestId: null,
      };
    case "SET_STYLE":
      return { ...s, style: event.style };
    case "SET_CONTEXT":
      return { ...s, context: truncate(event.text, 120) };
    case "OPEN_STEP":
      return { ...s, step: event.step };
    case "GENERATE_STARTED": {
      if (
        !s.image?.uploadId ||
        ["publishing", "generating", "regenerating"].includes(s.phase)
      )
        return s;
      const selected = selectedCaption(s);
      const retained =
        selected && selected.text !== selected.originalText
          ? { ...selected, source: "retained" as const }
          : s.retainedCandidate;
      return {
        ...s,
        step: 3,
        phase: s.candidates.length ? "regenerating" : "generating",
        activeRequestId: event.requestId,
        error: null,
        retainedCandidate: retained,
      };
    }
    case "GENERATE_SUCCEEDED":
      return {
        ...s,
        step: 4,
        phase: "editing",
        candidates: event.candidates,
        selectedId: s.retainedCandidate?.id || null,
        error: null,
        activeRequestId: null,
        mode: event.mode,
      };
    case "GENERATE_FAILED":
      return {
        ...s,
        step: s.candidates.length ? 4 : 3,
        phase: s.candidates.length ? "regeneration-error" : "generation-error",
        error: event.message,
        activeRequestId: null,
      };
    case "SELECT_CAPTION":
      return { ...s, selectedId: event.id, phase: "editing", error: null };
    case "EDIT_CAPTION":
      return {
        ...s,
        candidates: s.candidates.map((c) =>
          c.id === event.id ? { ...c, text: truncate(event.text, 200) } : c,
        ),
        retainedCandidate:
          s.retainedCandidate?.id === event.id
            ? { ...s.retainedCandidate, text: truncate(event.text, 200) }
            : s.retainedCandidate,
      };
    case "PUBLISH_STARTED":
      return {
        ...s,
        phase: "publishing",
        step: 5,
        activeRequestId: event.requestId,
        error: null,
      };
    case "PUBLISH_SUCCEEDED":
      return {
        ...s,
        phase: "published",
        publishedPostId: event.postId,
        error: null,
        activeRequestId: null,
      };
    case "PUBLISH_FAILED":
      return {
        ...s,
        phase: "publish-error",
        error: event.message,
        activeRequestId: null,
      };
  }
}
export function createCreateStore() {
  return createStore<CreateStore>((set) => ({
    ...initialState,
    dispatch: (event) => set((s) => reduceCreate(s, event)),
  }));
}
