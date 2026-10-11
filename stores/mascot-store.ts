import { createStore } from "zustand/vanilla";
export const MOODS = [
  "smirk",
  "wink",
  "huh",
  "annoyed",
  "pout",
  "confused",
  "thinking",
  "giggle",
  "cry",
  "heart",
  "smug",
  "omg",
] as const;
export type MascotMood = (typeof MOODS)[number];
export interface MascotStore {
  mood: MascotMood;
  expiresAt: number | null;
  pokeCount: 0 | 1 | 2;
  setMood: (mood: MascotMood, durationMs?: number) => void;
  resetMood: () => void;
  poke: () => void;
  dispose: () => void;
}
export function createMascotStore() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return createStore<MascotStore>((set, get) => ({
    mood: "smirk",
    expiresAt: null,
    pokeCount: 0,
    setMood(mood, durationMs = 2500) {
      stop();
      set({ mood, expiresAt: durationMs > 0 ? Date.now() + durationMs : null });
      if (durationMs > 0)
        timer = setTimeout(
          () => set({ mood: "smirk", expiresAt: null, pokeCount: 0 }),
          durationMs,
        );
    },
    resetMood() {
      stop();
      set({ mood: "smirk", expiresAt: null, pokeCount: 0 });
    },
    poke() {
      const next = ((get().pokeCount + 1) % 3) as 0 | 1 | 2;
      get().setMood(next === 1 ? "huh" : next === 2 ? "annoyed" : "smirk");
      set({ pokeCount: next });
    },
    dispose: stop,
  }));
}
