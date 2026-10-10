export type BabyPose = 'smirk' | 'wink' | 'flirt' | 'giggle' | 'smug' | 'pout' | 'cry' | 'huh' | 'gasp' | 'sleepy' | 'angel' | 'heart';
export const BUBBLE_LINES = [
  'I peaked at six months. Still ahead of you.',
  'Big diaper. Bigger expectations.',
  'Your camera roll called. It needs a writer.',
  'I have no job and excellent delivery.',
  'My bedtime is early. My standards are not.',
  'You bring the photos. I bring the audacity.',
  'Finally. Someone with less impulse control than me.',
  'I learned sarcasm before object permanence.',
];
export const TICKER_JOKES = [
  'My five-year plan is to turn five.',
  'I work from home. Mostly on the floor.',
  'My therapist says I need boundaries. So they bought a baby gate.',
  'I tried networking. Apparently biting is a weak introduction.',
  'I sleep like a baby. In short bursts, inconveniencing everyone.',
];
export type BabyState = {
  near: boolean; hover: boolean; leaving: boolean; sleeping: boolean;
  temporary: BabyPose | null; until: number; clicks: number[]; cycle: number; squash: number;
  line: number; login: 'none' | 'angel' | 'heart';
};
export const initialBaby: BabyState = { near: false, hover: false, leaving: false, sleeping: false, temporary: null, until: 0, clicks: [], cycle: 0, squash: 0, line: 0, login: 'none' };
export type BabyEvent =
  | { type: 'pointer'; near: boolean; leaving: boolean }
  | { type: 'hover'; value: boolean }
  | { type: 'poke'; now: number }
  | { type: 'wink'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'sleep' | 'wake' | 'login' | 'heart' | 'cancel' };
export function babyReducer(s: BabyState, e: BabyEvent): BabyState {
  if (s.login !== 'none' && !['heart', 'cancel'].includes(e.type)) return s;
  switch (e.type) {
    case 'pointer': return s.near === e.near && s.leaving === e.leaving && !s.sleeping ? s : { ...s, near: e.near, leaving: e.leaving, sleeping: false };
    case 'hover': return { ...s, hover: e.value, sleeping: false, leaving: e.value ? false : s.leaving };
    case 'wake': return s.sleeping ? { ...s, sleeping: false } : s;
    case 'sleep': return s.sleeping ? s : { ...s, sleeping: true, temporary: null, hover: false, near: false, leaving: false };
    case 'poke': {
      const clicks = [...s.clicks.filter(time => e.now - time < 2000), e.now];
      const annoyed = clicks.length >= 5;
      const poses: BabyPose[] = ['huh', 'gasp', 'pout'];
      return { ...s, clicks, cycle: s.cycle + 1, squash: s.squash + 1, temporary: annoyed ? 'smug' : poses[s.cycle % 3], until: e.now + (annoyed ? 3200 : 1700), sleeping: false, leaving: false, line: (s.line + 1) % BUBBLE_LINES.length };
    }
    case 'wink': return s.sleeping || s.hover || s.near || s.leaving || s.temporary ? s : { ...s, temporary: 'wink', until: e.now + 650, line: (s.line + 1) % BUBBLE_LINES.length };
    case 'tick': return s.temporary && e.now >= s.until ? { ...s, temporary: null } : s;
    case 'login': return { ...s, login: 'angel', sleeping: false };
    case 'heart': return { ...s, login: 'heart' };
    case 'cancel': return { ...initialBaby, line: s.line };
  }
}
export function babyView(s: BabyState): { pose: BabyPose; line: string } {
  if (s.login !== 'none') return { pose: s.login, line: 'Fine. You can sit with me.' };
  if (s.sleeping) return { pose: 'sleepy', line: "I've had diapers more exciting than this." };
  if (s.leaving) return { pose: 'cry', line: 'Wow. Okay. Leaving a baby.' };
  if (s.hover) return { pose: 'giggle', line: 'A good decision. Weird feeling, right?' };
  if (s.temporary && s.temporary !== 'wink') return { pose: s.temporary, line: s.temporary === 'smug' ? 'Are you done?' : BUBBLE_LINES[s.line] };
  if (s.near) return { pose: 'flirt', line: 'Go on. You know you want to.' };
  return { pose: s.temporary === 'wink' ? 'wink' : 'smirk', line: BUBBLE_LINES[s.line] };
}
export function tiltFromPoint(x: number, y: number, width: number, height: number) {
  const clamp = (v: number) => Math.max(-8, Math.min(8, v));
  return { x: clamp((0.5 - y / Math.max(height, 1)) * 16), y: clamp((x / Math.max(width, 1) - 0.5) * 16) };
}
