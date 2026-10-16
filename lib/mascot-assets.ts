import type { MascotMood } from "@/stores/mascot-store";

// Three pixels per CSS pixel for the 112px header mascot on Retina screens.
export const MASCOT_IMAGE_SIZE = 336;

export function mascotImage(mood: MascotMood) {
  return `/baby/bust/${mood}.webp`;
}
