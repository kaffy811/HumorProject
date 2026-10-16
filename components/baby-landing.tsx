"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { googleSignInUrl } from "@/lib/start-google-sign-in";
import {
  babyReducer,
  babyView,
  initialBaby,
  TICKER_JOKES,
  type BabyPose,
} from "@/lib/baby-machine";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="23" height="23" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.4Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.6-5l-6.7-5.2c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.7-3.6-11.3-8.4H5.8v5.4A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.7 27.3a12 12 0 0 1 0-6.6v-5.4H5.8a20 20 0 0 0 0 17.4l6.9-5.4Z"
      />
      <path
        fill="#EA4335"
        d="M24 12.3c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.3l6.9 5.4c1.6-4.8 6-8.4 11.3-8.4Z"
      />
    </svg>
  );
}
const POSES: BabyPose[] = [
  "wave",
  "smirk",
  "wink",
  "flirt",
  "giggle",
  "smug",
  "pout",
  "cry",
  "huh",
  "gasp",
  "sleepy",
  "angel",
  "heart",
];

export function BabyLanding({
  googleEnabled,
  callbackError,
}: {
  googleEnabled: boolean;
  callbackError: boolean;
}) {
  const [state, dispatch] = useReducer(babyReducer, initialBaby);
  const { pose, line } = babyView(state);
  const reduce = useReducedMotion();
  const squashControls = useAnimationControls();
  const loggingIn = useRef(false);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState(
    callbackError ? "Google sign-in did not finish. Give it another try." : "",
  );
  const [tickerPaused, setTickerPaused] = useState(false);

  useEffect(() => {
    if (!state.until || state.login !== "none") return;
    const timer = setTimeout(
      () => dispatch({ type: "tick", now: Date.now() }),
      Math.max(0, state.until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state.until, state.login]);
  useEffect(() => {
    squashControls.stop();
    if (!reduce && state.squash)
      void squashControls.start({
        scaleX: [1, 1.07, 0.96, 1],
        scaleY: [1, 0.91, 1.04, 1],
        transition: { duration: 0.5, ease: "easeOut" },
      });
    else squashControls.set({ scaleX: 1, scaleY: 1 });
  }, [state.squash, reduce, squashControls]);
  useEffect(
    () => () => {
      if (heartTimer.current) clearTimeout(heartTimer.current);
    },
    [],
  );
  async function google() {
    if (loggingIn.current) return;
    setMessage("");
    if (!googleEnabled) {
      setMessage(
        "Google sign-in is taking a little longer to get ready. Please come back soon.",
      );
      return;
    }
    loggingIn.current = true;
    dispatch({ type: "login" });
    heartTimer.current = setTimeout(
      () => dispatch({ type: "heart" }),
      reduce ? 120 : 420,
    );
    const started = Date.now();
    try {
      const url = await googleSignInUrl();
      const remaining = (reduce ? 250 : 1150) - (Date.now() - started);
      if (remaining > 0)
        await new Promise((resolve) => setTimeout(resolve, remaining));
      window.location.assign(url);
    } catch {
      if (heartTimer.current) clearTimeout(heartTimer.current);
      dispatch({ type: "cancel" });
      loggingIn.current = false;
      setMessage("Google sign-in did not finish. Give it another try.");
    }
  }
  return (
    <div className="baby-landing" data-baby-state={pose}>
      <div className="baby-ticker" aria-label="Five deeply unserious jokes">
        <div className="baby-ticker-tag">THE SMALL TALK</div>
        <div
          className={`baby-ticker-window ${tickerPaused ? "is-paused" : ""}`}
        >
          <div className="baby-ticker-track">
            {[0, 1].map((copy) => (
              <div
                className="baby-ticker-set"
                key={copy}
                aria-hidden={copy === 1}
              >
                {TICKER_JOKES.map((joke) => (
                  <span key={joke}>
                    <i aria-hidden="true">✳</i>
                    {joke}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <button
          className="baby-ticker-toggle"
          onClick={() => setTickerPaused((value) => !value)}
          aria-label={tickerPaused ? "Play joke ticker" : "Pause joke ticker"}
        >
          {tickerPaused ? "▶" : "Ⅱ"}
        </button>
      </div>
      <header className="baby-header flex items-center justify-between">
        <Link href="/" className="baby-brand">
          <span className="baby-brand-icon">h.</span>The Humor Project
          <span className="baby-brand-period" aria-hidden="true">
            ✳
          </span>
        </Link>
        <span className="baby-header-note">SMALL HUMAN. BIG OPINIONS.</span>
      </header>
      <main className="baby-main grid items-center">
        <section className="baby-copy">
          <span className="baby-kicker">
            <span /> THE INTERNET NEEDED A BABYSITTER.
          </span>
          <h1>
            Funnier
            <br />
            than you.
            <br />
            <span className="baby-title-last">
              And I can’t
              <br />
              even walk.
            </span>
          </h1>
          <p className="baby-description">
            Your photos. AI punchlines. Questionable judgment.
            <br className="baby-desktop-break" /> Welcome to a comedy club run
            by someone in a diaper.
          </p>
          <div className="baby-cta-zone">
            <motion.button
              className="baby-google"
              disabled={state.login !== "none"}
              onClick={() => void google()}
            >
              <GoogleMark />
              <span>
                {state.login !== "none"
                  ? "Making an entrance…"
                  : "Continue with Google"}
              </span>
              <span className="baby-cta-arrow" aria-hidden="true">
                ↗
              </span>
            </motion.button>
            <div className="baby-verified">
              <span aria-hidden="true">✓</span> Verified by Google
            </div>
            <p className="baby-small-print">
              One click. No passwords. I can’t read them anyway.
            </p>
            <p className="baby-login-message" role="status" aria-live="polite">
              {message}
            </p>
          </div>
          <div className="baby-copy-note">
            <span aria-hidden="true">✳</span> A little audacity goes a long
            way.
          </div>
        </section>
        <section
          className="baby-stage"
          aria-label="Meet Little Mao, your cheeky comedy host"
        >
          <div className="baby-halo" aria-hidden="true" />
          <span className="baby-star baby-star-one" aria-hidden="true">
            ✳
          </span>
          <span className="baby-star baby-star-two" aria-hidden="true">
            ✦
          </span>
          <span className="baby-stage-label" aria-hidden="true">
            YOUR HOST,
            <br />
            <strong>LITTLE MAO.</strong>
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={line}
              className="baby-speech"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
            >
              <span aria-hidden="true">“</span>
              {line}
            </motion.div>
          </AnimatePresence>
          <div className="baby-tilt">
            <motion.div
              className="baby-breathe"
              animate={
                !reduce && state.login === "none" ? { y: [0, -4, 0] } : { y: 0 }
              }
              transition={{
                duration: 3.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <motion.button
                className={`baby-character ${pose === "angel" ? "is-angel" : ""}`}
                aria-label="Poke the baby"
                disabled={state.login !== "none"}
                onClick={() => dispatch({ type: "poke", now: Date.now() })}
                animate={squashControls}
              >
                {POSES.map((p) => (
                  <Image
                    key={p}
                    src={`/baby/${p}.png`}
                    alt={p === pose ? `Little Mao looking ${pose}` : ""}
                    width={1254}
                    height={1254}
                    sizes="(max-width: 700px) 90vw, 48vw"
                    loading={p === "wave" ? "eager" : "lazy"}
                    className={`baby-pose ${p === pose ? "is-current" : ""}`}
                    aria-hidden={p !== pose}
                  />
                ))}
              </motion.button>
            </motion.div>
          </div>
          <div className="baby-floor-shadow" aria-hidden="true" />
          <div className="baby-poke">
            <span className="baby-poke-arrow" aria-hidden="true">
              ↙
            </span>{" "}
            👆 Poke the baby
            <span className="baby-poke-note">
              he has opinions about that, too.
            </span>
          </div>
        </section>
      </main>
      <div className="baby-bottom">
        <span>ZERO CREDENTIALS. EXCELLENT TIMING.</span>
        <Link href="/privacy">Privacy</Link>
        <span>A VERY SERIOUS STUDENT PROJECT.</span>
      </div>
      <AnimatePresence>
        {state.login === "heart" && (
          <motion.div
            className="baby-transition"
            initial={
              reduce ? { opacity: 0 } : { clipPath: "circle(0% at 72% 55%)" }
            }
            animate={
              reduce ? { opacity: 1 } : { clipPath: "circle(150% at 72% 55%)" }
            }
            exit={{ opacity: 0 }}
            transition={{
              duration: reduce ? 0.1 : 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            role="status"
          >
            <motion.div
              initial={reduce ? false : { scale: 0.5 }}
              animate={{ scale: reduce ? 1 : 8 }}
              transition={{ duration: 0.65 }}
            >
              <Image
                src="/baby/heart.png"
                width={640}
                height={640}
                alt="Little Mao holding a heart"
                unoptimized
                priority
              />
            </motion.div>
            <p>Fine. You can sit with me.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
