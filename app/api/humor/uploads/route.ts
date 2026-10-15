import { storageBucket } from "@/lib/supabase/schema";
import { imageError, IMAGE_MIMES } from "@/lib/create-contracts";
import {
  readJson,
  studioContext,
  studioFailure,
  StudioError,
} from "@/lib/studio-server";
export async function POST(request: Request) {
  try {
    const { user, admin } = await studioContext(request);
    const input = await readJson(request);
    if (
      !input ||
      !Number.isInteger(input.bytes) ||
      typeof input.mimeType !== "string" ||
      !(IMAGE_MIMES as readonly string[]).includes(input.mimeType)
    )
      throw new StudioError("Choose a JPG, PNG, WebP or GIF under 10 MB.");
    const invalid = imageError({ type: input.mimeType, size: input.bytes });
    if (invalid) throw new StudioError(invalid);
    const extension = input.mimeType.split("/")[1];
    const { data: uploadId, error } = await admin.rpc("create_humor_draft", {
      owner: user.id,
      mime: input.mimeType,
      byte_count: input.bytes,
      extension,
    });
    if (error) {
      if (error.message.includes("Upload limit"))
        throw new StudioError(
          "Too many upload attempts. Give the camera roll a minute.",
          429,
        );
      throw error;
    }
    const path = `${user.id}/${uploadId}.${extension}`;
    const { data: signed, error: signError } = await admin.storage
      .from(storageBucket("humor-images"))
      .createSignedUploadUrl(path, { upsert: false });
    if (signError || !signed) throw signError;
    return Response.json(
      { draftId: uploadId, uploadId, path, token: signed.token, bucket:storageBucket("humor-images") },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return studioFailure(error);
  }
}
