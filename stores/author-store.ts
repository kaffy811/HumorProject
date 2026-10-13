"use client";
import { create } from "zustand";
import type { PublicAuthor } from "@/lib/profile-contracts";
export const useAuthorStore = create<{
  authors: Record<string, PublicAuthor>;
  put: (author: PublicAuthor) => void;
}>((set) => ({
  authors: {},
  put: (author) =>
    set((s) => ({ authors: { ...s.authors, [author.id]: author } })),
}));
export function usePublicAuthor(author: PublicAuthor) {
  return useAuthorStore((s) => s.authors[author.id]) || author;
}
