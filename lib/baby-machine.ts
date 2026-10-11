export type BabyPose =
  | "wave"
  | "smirk"
  | "wink"
  | "flirt"
  | "giggle"
  | "smug"
  | "pout"
  | "cry"
  | "huh"
  | "gasp"
  | "sleepy"
  | "angel"
  | "heart";
export const GREETING = "Oh good. You're here.";
export const POKE_POSES: BabyPose[] = [
  "huh",
  "gasp",
  "pout",
  "smug",
  "giggle",
  "wink",
  "flirt",
  "smirk",
  "sleepy",
  "cry",
];
export const BUBBLE_LINES = [
  "I asked for a raise. They lifted me out of the crib.",
  "My résumé says I thrive under pressure. It means tummy time.",
  "I have a personal chef. She calls it unpaid labor.",
  "I started a podcast. So far, it's mostly complaints.",
  "I'm very grounded. Nobody trusts me with stairs.",
  "My portfolio is diversified. Toys in every room.",
  "I tried meal prep. It ended up on the ceiling.",
  "I have executive presence. People carry me into meetings.",
  "I believe in passive income. Mostly the tooth fairy.",
  "My social battery is full. My actual battery is applesauce.",
  "I dress for the job I want. Apparently it's lifeguard.",
  "I'm handling adulthood by refusing to start.",
];
export const TICKER_JOKES = [
  "My five-year plan is to turn five.",
  "I work from home. Mostly on the floor.",
  "My therapist says I need boundaries. So they bought a baby gate.",
  "I tried networking. Apparently biting is a weak introduction.",
  "I sleep like a baby. In short bursts, inconveniencing everyone.",
];
export type BabyState = {
  temporary: BabyPose | null;
  until: number;
  cycle: number;
  line: number;
  squash: number;
  login: "none" | "angel" | "heart";
};
export const initialBaby: BabyState = {
  temporary: null,
  until: 0,
  cycle: 0,
  squash: 0,
  line: -1,
  login: "none",
};
export type BabyEvent =
  | { type: "poke" | "tick"; now: number }
  | { type: "login" | "heart" | "cancel" };
export function babyReducer(s: BabyState, e: BabyEvent): BabyState {
  if (s.login !== "none" && !["heart", "cancel"].includes(e.type)) return s;
  switch (e.type) {
    case "poke":
      return {
        ...s,
        cycle: s.cycle + 1,
        line: (s.line + 1) % BUBBLE_LINES.length,
        squash: s.squash + 1,
        temporary: POKE_POSES[s.cycle % POKE_POSES.length],
        until: e.now + 8000,
      };
    case "tick":
      return s.temporary && e.now >= s.until
        ? { ...s, temporary: null, until: 0 }
        : s;
    case "login":
      return { ...s, login: "angel" };
    case "heart":
      return { ...s, login: "heart" };
    case "cancel":
      return { ...s, temporary: null, until: 0, login: "none" };
  }
}
export function babyView(s: BabyState): { pose: BabyPose; line: string } {
  if (s.login !== "none")
    return { pose: s.login, line: "Fine. You can sit with me." };
  return s.temporary
    ? { pose: s.temporary, line: BUBBLE_LINES[s.line] }
    : { pose: "wave", line: GREETING };
}
