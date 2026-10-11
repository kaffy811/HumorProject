"use client";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useStores } from "@/stores/StoreProvider";
import { selectedCaption } from "@/stores/create-store";
import { characterCount, imageError } from "@/lib/create-contracts";
import { uploadImage } from "@/lib/uploadImage";
import { generateCaptions } from "@/lib/generateCaptions";
import { publishPost } from "@/lib/publishPost";
export function useCreateController() {
  const { create, mascot } = useStores();
  const router = useRouter();
  const file = useRef<File | null>(null);
  const active = useRef<AbortController | null>(null);
  const preview = useRef<string | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publicationKey = useRef<string | null>(null);
  const dispatch = create.getState().dispatch;
  useEffect(() => {
    mascot.getState().setMood("confused", 0);
    return () => {
      active.current?.abort();
      if (preview.current) URL.revokeObjectURL(preview.current);
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
      create.getState().dispatch({ type: "RESET" });
      mascot.getState().resetMood();
    };
  }, [create, mascot]);
  const selectFile = useCallback(
    async (selected: File) => {
      const error = imageError(selected);
      if (error) throw new Error(error);
      if (["publishing", "published"].includes(create.getState().phase)) return;
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const requestId = crypto.randomUUID();
      file.current = selected;
      publicationKey.current = null;
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = URL.createObjectURL(selected);
      dispatch({
        type: "IMAGE_SELECTED",
        requestId,
        image: {
          uploadId: null,
          previewUrl: preview.current,
          filename: selected.name,
          mimeType: selected.type,
          bytes: selected.size,
        },
      });
      mascot.getState().setMood("confused", 0);
      try {
        const result = await uploadImage(selected, controller.signal);
        if (controller.signal.aborted) return;
        dispatch({ type: "UPLOAD_READY", requestId, ...result });
        mascot.getState().resetMood();
      } catch (error) {
        if (controller.signal.aborted) return;
        dispatch({
          type: "UPLOAD_FAILED",
          requestId,
          message:
            error instanceof Error
              ? error.message
              : "Upload failed. Try again.",
        });
        mascot.getState().setMood("cry");
      }
    },
    [create, dispatch, mascot],
  );
  const generate = useCallback(async () => {
    const s = create.getState();
    if (
      !s.image?.uploadId ||
      ["generating", "regenerating", "publishing", "published"].includes(
        s.phase,
      )
    )
      return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const requestId = crypto.randomUUID();
    dispatch({ type: "GENERATE_STARTED", requestId });
    mascot.getState().setMood("thinking", 0);
    try {
      const result = await generateCaptions(
        {
          uploadId: s.image.uploadId,
          style: s.style,
          context: s.context,
          requestId,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      dispatch({ type: "GENERATE_SUCCEEDED", requestId, ...result });
      mascot.getState().setMood("giggle");
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({
        type: "GENERATE_FAILED",
        requestId,
        message:
          error instanceof Error
            ? error.message
            : "Could not generate. Try again.",
      });
      mascot.getState().setMood("cry");
    }
  }, [create, dispatch, mascot]);
  const publish = useCallback(async () => {
    const s = create.getState();
    const selected = selectedCaption(s);
    if (
      !s.draftId ||
      !selected?.text.trim() ||
      characterCount(selected.text) > 200 ||
      ["publishing", "published", "generating", "regenerating"].includes(
        s.phase,
      )
    )
      return;
    const controller = new AbortController();
    active.current = controller;
    const requestId = crypto.randomUUID();
    publicationKey.current ||= crypto.randomUUID();
    dispatch({ type: "PUBLISH_STARTED", requestId });
    try {
      const result = await publishPost(
        {
          draftId: s.draftId,
          generationId: selected.generationId,
          candidateId: selected.id,
          content: selected.text.trim(),
          idempotencyKey: publicationKey.current,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      dispatch({ type: "PUBLISH_SUCCEEDED", requestId, postId: result.postId });
      mascot.getState().setMood("heart");
      redirectTimer.current = setTimeout(() => router.push(result.href), 1500);
    } catch (error) {
      if (controller.signal.aborted) return;
      dispatch({
        type: "PUBLISH_FAILED",
        requestId,
        message:
          error instanceof Error
            ? error.message
            : "Could not publish. Try again.",
      });
      mascot.getState().setMood("cry");
    }
  }, [create, dispatch, mascot, router]);
  return {
    selectFile,
    generate,
    publish,
    retryUpload: () => file.current && selectFile(file.current),
    removeImage: () => {
      if (["publishing", "published"].includes(create.getState().phase)) return;
      active.current?.abort();
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = null;
      file.current = null;
      publicationKey.current = null;
      dispatch({ type: "REMOVE_IMAGE" });
      mascot.getState().setMood("confused", 0);
    },
  };
}
