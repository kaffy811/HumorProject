"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MASCOT_IMAGE_SIZE, mascotImage } from "@/lib/mascot-assets";
import { useMascot, useStores } from "@/stores/StoreProvider";
export function Mascot() {
  const mood = useMascot((s) => s.mood),
    poke = useMascot((s) => s.poke);
  const { mascot } = useStores();
  const reduced = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(mood);
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.src = mascotImage(mood);
    img
      .decode()
      .then(() => {
        if (active) setVisible(mood);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [mood]);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 80);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);
  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const idle = () => {
      timer = setTimeout(
        () => {
          if (mascot.getState().mood === "smirk")
            mascot.getState().setMood("wink", 300);
          idle();
        },
        5000 + Math.random() * 3000,
      );
    };
    idle();
    return () => clearTimeout(timer);
  }, [mascot, reduced]);
  return (
    <button
      type="button"
      className={`header-mascot ${scrolled ? "is-scrolled" : ""}`}
      aria-label="Poke the mascot"
      onClick={poke}
    >
      <motion.img
        key={visible}
        src={mascotImage(visible)}
        alt=""
        aria-hidden="true"
        width={MASCOT_IMAGE_SIZE}
        height={MASCOT_IMAGE_SIZE}
        initial={reduced ? false : { scaleY: 0.94 }}
        animate={{ scaleY: 1 }}
        transition={{ type: "spring", stiffness: 330, damping: 15 }}
        draggable={false}
      />
    </button>
  );
}
