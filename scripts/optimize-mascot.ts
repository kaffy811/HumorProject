// node --import tsx scripts/optimize-mascot.ts
// Keep the original artwork; generate small, transparent header derivatives.
import { stat } from "node:fs/promises";
import sharp from "sharp";
import { MOODS } from "../stores/mascot-store";
import { MASCOT_IMAGE_SIZE, mascotImage } from "../lib/mascot-assets";

async function main() {
  let originalBytes = 0;
  let optimizedBytes = 0;
  for (const mood of MOODS) {
    const input = `public/baby/bust/${mood}.png`;
    const output = `public${mascotImage(mood)}`;
    await sharp(input)
      .resize(MASCOT_IMAGE_SIZE, MASCOT_IMAGE_SIZE, { withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 100, effort: 6 })
      .toFile(output);
    originalBytes += (await stat(input)).size;
    optimizedBytes += (await stat(output)).size;
  }
  console.log(JSON.stringify({
    images: MOODS.length,
    dimensions: MASCOT_IMAGE_SIZE,
    originalBytes,
    optimizedBytes,
    reductionPercent: Number(((1 - optimizedBytes / originalBytes) * 100).toFixed(2)),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
