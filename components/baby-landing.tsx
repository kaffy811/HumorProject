'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion, useSpring } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { babyReducer, babyView, initialBaby, tiltFromPoint, TICKER_JOKES, type BabyPose } from '@/lib/baby-machine';

function GoogleMark() {
  return <svg viewBox="0 0 48 48" width="23" height="23" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.4Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.6-5l-6.7-5.2c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.7-3.6-11.3-8.4H5.8v5.4A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.7 27.3a12 12 0 0 1 0-6.6v-5.4H5.8a20 20 0 0 0 0 17.4l6.9-5.4Z"/><path fill="#EA4335" d="M24 12.3c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.3l6.9 5.4c1.6-4.8 6-8.4 11.3-8.4Z"/></svg>;
}
const POSES: BabyPose[] = ['smirk', 'wink', 'flirt', 'giggle', 'smug', 'pout', 'cry', 'huh', 'gasp', 'sleepy', 'angel', 'heart'];
type OrientationPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

export function BabyLanding({ googleEnabled, callbackError }: { googleEnabled: boolean; callbackError: boolean }) {
  const [state, dispatch] = useReducer(babyReducer, initialBaby);
  const { pose, line } = babyView(state);
  const reduce = useReducedMotion();
  const squashControls = useAnimationControls();
  const tiltX = useSpring(0, { stiffness: 95, damping: 18 });
  const tiltY = useSpring(0, { stiffness: 95, damping: 18 });
  const cta = useRef<HTMLButtonElement>(null);
  const activeAt = useRef(0);
  const loggingIn = useRef(false);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState(callbackError ? 'Google sign-in did not finish. Give it another try.' : '');
  const [gyro, setGyro] = useState(false);
  const [sensorMessage, setSensorMessage] = useState('');
  const [tickerPaused, setTickerPaused] = useState(false);

  useEffect(() => {
    activeAt.current = Date.now();
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const activity = () => { activeAt.current = Date.now(); dispatch({ type: 'wake' }); };
    const move = (e: PointerEvent) => {
      if (coarse || e.pointerType === 'touch') return;
      activity();
      if (!reduce) { const tilt = tiltFromPoint(e.clientX, e.clientY, innerWidth, innerHeight); tiltX.set(tilt.x); tiltY.set(tilt.y); }
      const bounds = cta.current?.getBoundingClientRect();
      const distance = bounds ? Math.hypot(Math.max(bounds.left - e.clientX, 0, e.clientX - bounds.right), Math.max(bounds.top - e.clientY, 0, e.clientY - bounds.bottom)) : Infinity;
      dispatch({ type: 'pointer', near: distance < 140, leaving: e.clientY < 28 });
    };
    const leave = (e: PointerEvent) => { if (!coarse && e.clientY <= 0) dispatch({ type: 'pointer', near: false, leaving: true }); tiltX.set(0); tiltY.set(0); };
    window.addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', leave);
    const events = ['pointerdown', 'keydown', 'scroll', 'focusin'] as const;
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    const tick = setInterval(() => {
      const now = Date.now(); dispatch({ type: 'tick', now });
      if (now - activeAt.current >= 20000) dispatch({ type: 'sleep' });
    }, 200);
    let wink: ReturnType<typeof setTimeout>;
    const schedule = () => { wink = setTimeout(() => { if (!document.hidden) dispatch({ type: 'wink', now: Date.now() }); schedule(); }, 4000 + Math.random() * 2000); };
    schedule();
    return () => {
      clearInterval(tick); clearTimeout(wink);
      window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave);
      events.forEach(event => window.removeEventListener(event, activity));
    };
  }, [reduce, tiltX, tiltY]);
  useEffect(() => { if (reduce) { tiltX.set(0); tiltY.set(0); } }, [reduce, tiltX, tiltY]);
  useEffect(() => {
    squashControls.stop();
    if (!reduce && state.squash) void squashControls.start({ scaleX: [1, 1.07, 0.96, 1], scaleY: [1, 0.91, 1.04, 1], transition: { duration: 0.5, ease: 'easeOut' } });
    else squashControls.set({ scaleX: 1, scaleY: 1 });
  }, [state.squash, reduce, squashControls]);
  useEffect(() => () => { if (heartTimer.current) clearTimeout(heartTimer.current); }, []);
  useEffect(() => {
    if (!gyro || reduce) return;
    const orient = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      activeAt.current = Date.now(); dispatch({ type: 'wake' });
      tiltX.set(Math.max(-8, Math.min(8, (event.beta - 35) / 5)));
      tiltY.set(Math.max(-8, Math.min(8, event.gamma / 4)));
    };
    window.addEventListener('deviceorientation', orient);
    return () => { window.removeEventListener('deviceorientation', orient); tiltX.set(0); tiltY.set(0); };
  }, [gyro, reduce, tiltX, tiltY]);

  async function enableTilt() {
    setSensorMessage('');
    if (gyro) { setGyro(false); return; }
    if (typeof DeviceOrientationEvent === 'undefined') { setSensorMessage('This phone cannot tilt the baby. A poke still works.'); return; }
    try {
      const request = (DeviceOrientationEvent as OrientationPermission).requestPermission;
      if (request && await request.call(DeviceOrientationEvent) !== 'granted') { setSensorMessage('No tilt permission. He will survive.'); return; }
      setGyro(true);
    } catch { setSensorMessage('Tilt is unavailable. Try a poke instead.'); }
  }
  async function google() {
    if (loggingIn.current) return;
    activeAt.current = Date.now(); setMessage('');
    if (!googleEnabled) { setMessage('Google sign-in is taking a little longer to get ready. Please come back soon.'); return; }
    loggingIn.current = true; dispatch({ type: 'login' });
    heartTimer.current = setTimeout(() => dispatch({ type: 'heart' }), reduce ? 120 : 420);
    const started = Date.now();
    try {
      const { data, error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback`, skipBrowserRedirect: true } });
      if (error || !data.url) throw error || new Error('Missing sign-in URL');
      const remaining = (reduce ? 250 : 1150) - (Date.now() - started);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
      window.location.assign(data.url);
    } catch {
      if (heartTimer.current) clearTimeout(heartTimer.current);
      dispatch({ type: 'cancel' }); loggingIn.current = false;
      setMessage('Google sign-in did not finish. Give it another try.');
    }
  }
  return <div className="baby-landing" data-baby-state={pose}>
    <header className="baby-header flex items-center justify-between"><Link href="/" className="baby-brand"><span className="baby-brand-icon">h.</span>The Humor Project<span className="baby-brand-period" aria-hidden="true">✳</span></Link><span className="baby-header-note">SMALL HUMAN. BIG OPINIONS.</span></header>
    <main className="baby-main grid items-center">
      <section className="baby-copy">
        <span className="baby-kicker"><span /> THE INTERNET NEEDED A BABYSITTER.</span>
        <h1>Funnier<br/>than you.<br/><span className="baby-title-last">And I can’t<br/>even walk.</span></h1>
        <p className="baby-description">Your photos. AI punchlines. Questionable judgment.<br className="baby-desktop-break"/> Welcome to a comedy club run by someone in a diaper.</p>
        <div className="baby-cta-zone">
          <motion.button ref={cta} className="baby-google" disabled={state.login !== 'none'} onClick={() => void google()}
            onPointerEnter={() => dispatch({ type: 'hover', value: true })} onPointerLeave={() => dispatch({ type: 'hover', value: false })}
            onFocus={() => dispatch({ type: 'hover', value: true })} onBlur={() => dispatch({ type: 'hover', value: false })}
            animate={!reduce && state.hover && state.login === 'none' ? { rotate: [0, -1, 1, -0.7, 0.7, 0] } : { rotate: 0 }} transition={{ duration: 0.45 }}>
            <GoogleMark /><span>{state.login !== 'none' ? 'Making an entrance…' : 'Continue with Google'}</span><span className="baby-cta-arrow" aria-hidden="true">↗</span>
          </motion.button>
          <div className="baby-verified"><span aria-hidden="true">✓</span> Verified by Google <span className="baby-verified-dot">·</span> Members only</div>
          <p className="baby-small-print">One click. No passwords. I can’t read them anyway.</p>
          <p className="baby-login-message" role="status" aria-live="polite">{message}</p>
        </div>
        <div className="baby-copy-note"><span aria-hidden="true">✳</span> A little audacity goes a long way.</div>
      </section>
      <section className="baby-stage" aria-label="Meet Little Mao, your cheeky comedy host">
        <div className="baby-halo" aria-hidden="true" /><span className="baby-star baby-star-one" aria-hidden="true">✳</span><span className="baby-star baby-star-two" aria-hidden="true">✦</span>
        <span className="baby-stage-label" aria-hidden="true">YOUR HOST,<br/><strong>LITTLE MAO.</strong></span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={line} className="baby-speech" initial={reduce ? false : { opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.15 }}>
            <span aria-hidden="true">“</span>{line}
          </motion.div>
        </AnimatePresence>
        <motion.div className="baby-tilt" style={{ rotateX: reduce ? 0 : tiltX, rotateY: reduce ? 0 : tiltY }}>
          <motion.div className="baby-breathe" animate={!reduce && state.login === 'none' ? { y: [0, -7, 0] } : { y: 0 }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}>
            <motion.button className={`baby-character ${pose === 'angel' ? 'is-angel' : ''}`} aria-label="Poke the baby" disabled={state.login !== 'none'} onClick={() => dispatch({ type: 'poke', now: Date.now() })}
              animate={squashControls}>
              {POSES.map(p => <Image key={p} src={`/baby/${p}.png`} alt={p === pose ? `Little Mao looking ${pose}` : ''} width={1254} height={1254} sizes="(max-width: 700px) 90vw, 48vw" loading={p === 'smirk' ? 'eager' : 'lazy'} className={`baby-pose ${p === pose ? 'is-current' : ''}`} aria-hidden={p !== pose} />)}
            </motion.button>
          </motion.div>
        </motion.div>
        <div className="baby-floor-shadow" aria-hidden="true" />
        <div className="baby-poke"><span className="baby-poke-arrow" aria-hidden="true">↖</span> 👆 Poke the baby<span className="baby-poke-note">he has opinions about that, too.</span></div>
        {!reduce && <button className="baby-gyro" onClick={() => void enableTilt()} aria-pressed={gyro}>{gyro ? 'Turn phone tilt off' : 'Tilt with your phone ↗'}</button>}
        {sensorMessage && <p className="baby-sensor-message" role="status">{sensorMessage}</p>}
      </section>
    </main>
    <div className="baby-ticker" aria-label="Five deeply unserious jokes"><div className="baby-ticker-tag">THE SMALL TALK</div><div className={`baby-ticker-window ${tickerPaused ? 'is-paused' : ''}`}><div className="baby-ticker-track">{[0, 1].map(copy => <div className="baby-ticker-set" key={copy} aria-hidden={copy === 1}>{TICKER_JOKES.map(joke => <span key={joke}><i aria-hidden="true">✳</i>{joke}</span>)}</div>)}</div></div><button className="baby-ticker-toggle" onClick={() => setTickerPaused(value => !value)} aria-label={tickerPaused ? 'Play joke ticker' : 'Pause joke ticker'}>{tickerPaused ? '▶' : 'Ⅱ'}</button></div>
    <div className="baby-bottom"><span>ZERO CREDENTIALS. EXCELLENT TIMING.</span><Link href="/privacy">Privacy</Link><span>A VERY SERIOUS STUDENT PROJECT.</span></div>
    <AnimatePresence>{state.login === 'heart' && <motion.div className="baby-transition" initial={reduce ? { opacity: 0 } : { clipPath: 'circle(0% at 72% 55%)' }} animate={reduce ? { opacity: 1 } : { clipPath: 'circle(150% at 72% 55%)' }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.1 : 0.6, ease: [0.22, 1, 0.36, 1] }} role="status"><motion.div initial={reduce ? false : { scale: 0.5 }} animate={{ scale: reduce ? 1 : 8 }} transition={{ duration: 0.65 }}><Image src="/baby/heart.png" width={640} height={640} alt="Little Mao holding a heart" unoptimized priority /></motion.div><p>Fine. You can sit with me.</p></motion.div>}</AnimatePresence>
  </div>;
}
