import sharp from "sharp";
import { imageType } from "../humor-validation";
export async function prepareImage(bytes: Uint8Array, limit = 10_000_000) {
  if (!bytes.length || bytes.length > limit)
    throw Error("That image is too large.");
  const mime =
    imageType(bytes) ||
    (["GIF87a", "GIF89a"].includes(Buffer.from(bytes.subarray(0, 6)).toString())
      ? "image/gif"
      : null);
  if (!mime) throw Error("Choose a JPG, PNG, WebP or GIF.");
  const { data, info } = await sharp(bytes, {
    animated: false,
    limitInputPixels: 40_000_000,
    failOn: "warning",
  })
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: data,
    width: info.width,
    height: info.height,
    mime: "image/webp" as const,
  };
}
