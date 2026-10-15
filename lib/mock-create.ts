import "server-only";
import { randomUUID } from "node:crypto";
import type { CaptionCandidate } from "./create-contracts";
import { prepareImage } from "./media/prepare-image";
import { mockPublish } from "./mock-posts";
interface Draft {
  owner: string;
  id: string;
  mime: string;
  bytes: number;
  image?: Uint8Array;
  width?: number;
  height?: number;
  candidates?: CaptionCandidate[];
  published?: string;
}
const state = globalThis as typeof globalThis & {
  humorMockDrafts?: Map<string, Draft>;
};
state.humorMockDrafts ||= new Map();
export function reserveMockDraft(owner: string, mime: string, bytes: number) {
  const id = randomUUID();
  state.humorMockDrafts!.set(id, { owner, id, mime, bytes });
  return { id, draftId: id, uploadId: id, mock: true };
}
export function mockDraft(owner: string, id: string) {
  const d = state.humorMockDrafts!.get(id);
  return d?.owner === owner ? d : null;
}
export async function uploadMockDraft(owner: string, id: string, file: File) {
  const d = mockDraft(owner, id);
  if (!d || file.type !== d.mime || file.size !== d.bytes)
    throw Error("Invalid mock upload.");
  const p = await prepareImage(new Uint8Array(await file.arrayBuffer()));
  d.image = p.bytes;
  d.width = p.width;
  d.height = p.height;
  return { draftId: id, uploadId: id };
}
export function generateMockDraft(owner: string, id: string) {
  const d = mockDraft(owner, id);
  if (!d?.image) throw Error("Upload the photo first.");
  const generationId = randomUUID();
  d.candidates = [
    ["A photo with the confidence of a group project leader.", "Deadpan"],
    ["My camera roll has better attendance than I do.", "Roast"],
    ["A small moment. An unnecessarily large personality.", "Absurd"],
    [
      "Proof that a picture is worth at least four mediocre jokes.",
      "Wholesome",
    ],
  ].map(([text, style]) => ({
    id: randomUUID(),
    generationId,
    style: style as CaptionCandidate["style"],
    text,
    originalText: text,
    source: "generated",
  }));
  return { generationId, candidates: d.candidates, mode: "mock" };
}
export function publishMockDraft(
  owner: string,
  id: string,
  caption: string,
  handmade: boolean,
  candidateId: string,
) {
  const d = mockDraft(owner, id);
  if (!d?.image) throw Error("Upload the photo first.");
  const candidate = d.candidates?.find((c) => c.id === candidateId);
  if (!handmade && !candidate) throw Error("Choose a caption.");
  if (!d.published)
    d.published = mockPublish(owner, {
      imageUrl: `/api/humor/uploads/${id}/mock`,
      imageWidth: d.width!,
      imageHeight: d.height!,
      caption,
      style: handmade ? "HANDMADE" : candidate!.style,
    }).id;
  return { postId: d.published, href: `/post/${d.published}`, mode: "mock" };
}
