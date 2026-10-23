"use client";
import { motion, useReducedMotion } from "framer-motion";

export function BrokenHeartGlyph({ active, burst = 0 }: { active: boolean; burst?: number }) {
  const reduced = useReducedMotion();
  const crying = active && burst > 0 && !reduced;
  return (
    <span className="heart-glyph broken-heart-glyph" aria-hidden="true">
      <motion.svg key={`broken-${burst}-${active}`} width="24" height="24" viewBox="0 0 24 24"
        fill={active ? "var(--color-dislike)" : "none"} stroke={active ? "var(--color-dislike)" : "currentColor"}
        strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
        initial={crying ? { opacity: 0, scale: 0.8 } : false}
        animate={{ opacity: 1, scale: 1 }} transition={{ delay: crying ? 0.22 : 0, duration: reduced ? 0 : 0.25 }}>
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
        <path d="m12 4-2 4 4 4-4 4 2 5" fill="none"
          stroke={active ? "var(--color-paper)" : "currentColor"} strokeWidth={active ? 2.8 : 1.8} />
      </motion.svg>
      {crying && <motion.img key={`cry-${burst}`} src="/baby/bust/cry.webp" alt="" width={28} height={28}
        initial={{ opacity: 1, scale: 0.85 }} animate={{ opacity: [1, 1, 0], scale: [0.85, 1.1, 0.9] }}
        transition={{ duration: 0.5, times: [0, 0.45, 1] }} />}
    </span>
  );
}
