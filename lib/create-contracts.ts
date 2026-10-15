export const STYLES = [
  "Deadpan",
  "Roast",
  "Pun",
  "Dad joke",
  "Absurd",
  "Wholesome",
] as const;
export type JokeStyle = (typeof STYLES)[number];
export const MAX_IMAGE_BYTES = 10_000_000;
export const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type Author = {
  name: string;
  username: string;
  avatarUrl: string | null;
};
export interface CaptionCandidate {
  id: string;
  generationId: string | null;
  style: JokeStyle | "HANDMADE";
  originalText: string;
  text: string;
  source: "generated" | "retained" | "handmade";
}
export interface GenerateCaptionsInput {
  uploadId: string;
  context: string;
  requestId: string;
}
export interface GenerateCaptionsResult {
  generationId: string;
  mode: "live" | "mock";
  candidates: [
    CaptionCandidate,
    CaptionCandidate,
    CaptionCandidate,
    CaptionCandidate,
  ];
}
export function characterCount(text: string) {
  return Array.from(text).length;
}
export function truncate(text: string, length: number) {
  return Array.from(text).slice(0, length).join("");
}
export function validStyle(value: unknown): value is JokeStyle {
  return typeof value === "string" && STYLES.includes(value as JokeStyle);
}
export function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function imageError(file: Pick<File, "type" | "size">) {
  if (!(IMAGE_MIMES as readonly string[]).includes(file.type))
    return "Choose a JPG, PNG, WebP or GIF. The baby has standards.";
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    return "Keep it under 10 MB. This is comedy, not a documentary.";
  return null;
}
