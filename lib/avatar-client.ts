import { MAX_AVATAR_BYTES } from "./profile-contracts";
export async function cropAvatarFile(
  file: File,
  crop?: { x: number; y: number; size: number },
) {
  if (
    !file.size ||
    file.size > MAX_AVATAR_BYTES ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw Error("Choose a JPG, PNG or WebP under 5 MB.");
  const image = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const size = crop?.size ?? Math.min(image.width, image.height),
      x = crop?.x ?? Math.floor((image.width - size) / 2),
      y = crop?.y ?? Math.floor((image.height - size) / 2);
    if (
      size < 1 ||
      x < 0 ||
      y < 0 ||
      x + size > image.width ||
      y + size > image.height
    )
      throw Error("Choose a square crop.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Photo preview unavailable. Try another browser.");
    ctx.drawImage(image, x, y, size, size, 0, 0, 512, 512);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(Error("Could not prepare that photo.")),
        "image/webp",
        0.92,
      ),
    );
    return new File([blob], "avatar.webp", { type: "image/webp" });
  } finally {
    image.close();
  }
}
