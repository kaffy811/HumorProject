import { storageBucket } from "@/lib/supabase/schema";
import { prepareImage } from "@/lib/media/prepare-image";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { MAX_IMAGE_BYTES, validUuid } from "@/lib/create-contracts";
import { imageType } from "@/lib/humor-validation";
import { studioContext, studioFailure, StudioError } from "@/lib/studio-server";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, admin } = await studioContext(request);
    const { id } = await params;
    if (!validUuid(id)) throw new StudioError("Invalid upload.");
    const { data: draft, error } = await admin
      .from("humor_drafts")
      .select("*")
      .eq("image_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!draft) throw new StudioError("Upload not found.", 404);
    if (draft.upload_status === "ready")
      return Response.json({ draftId: id, uploadId: id });
    const { data: file, error: download } = await admin.storage
      .from(storageBucket("humor-images"))
      .download(draft.image_path);
    if (download || !file)
      throw new StudioError("Upload did not finish. Try again.");
    if (
      !file.size ||
      file.size > MAX_IMAGE_BYTES ||
      file.size !== draft.byte_count
    )
      throw new StudioError(
        "The uploaded image size does not match. Choose the image again.",
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const header = Buffer.from(bytes.subarray(0, 6)).toString();
    const mime =
      imageType(bytes) ||
      (["GIF87a", "GIF89a"].includes(header) ? "image/gif" : null);
    if (mime !== draft.image_mime)
      throw new StudioError(
        "The file is not the image format it claims to be.",
      );
    const processor = sharp(bytes, {
      animated: false,
      limitInputPixels: 40_000_000,
      failOn: "warning",
    });
    const metadata = await processor.metadata();
    if (!metadata.width || !metadata.height)
      throw new StudioError("The image could not be opened. Choose another.");
    const swapped = (metadata.orientation || 0) >= 5;
    const { error: dimensionsError } = await admin
      .from("humor_images")
      .update({
        image_width: swapped ? metadata.height : metadata.width,
        image_height: swapped
          ? metadata.width
          : metadata.pageHeight || metadata.height,
      })
      .eq("id", id)
      .eq("user_id", user.id);
    if (dimensionsError) throw dimensionsError;
    // Validate actual decoding; GIF is sent to Gemini as its first-frame PNG.
    const normalized = await processor
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    const aiPath = `${user.id}/${id}-ai.png`;
    const { error: upload } = await admin.storage
      .from(storageBucket("humor-images"))
      .upload(aiPath, normalized, { contentType: "image/png", upsert: true });
    if (upload) throw upload;
    let displayPath = draft.image_path;
    if (mime !== "image/gif") {
      const display = await prepareImage(bytes);
      displayPath = `${user.id}/${id}-display.webp`;
      const source = await admin.storage
        .from(storageBucket("humor-images"))
        .upload(displayPath, display.bytes, {
          contentType: display.mime,
          upsert: true,
        });
      if (source.error) throw source.error;
      const dims = await admin
        .from("humor_images")
        .update({ image_width: display.width, image_height: display.height })
        .eq("id", id)
        .eq("user_id", user.id);
      if (dims.error) throw dims.error;
    }
    const { error: saved } = await admin
      .from("humor_drafts")
      .update({
        upload_status: "ready",
        image_path: displayPath,
        ai_path: aiPath,
        image_sha256: createHash("sha256").update(normalized).digest("hex"),
      })
      .eq("image_id", id)
      .eq("user_id", user.id);
    if (saved) throw saved;
    if (displayPath !== draft.image_path)
      await admin.storage.from(storageBucket("humor-images")).remove([draft.image_path]);
    return Response.json({ draftId: id, uploadId: id });
  } catch (error) {
    return studioFailure(error);
  }
}
