import { useEffect, useRef } from 'react';

// ─── Configuration audio portée de 602/main.js ───────────────────────────────
const AUDIO_CONFIG = {
  explo: {
    src: '/sounds/explo.mp3',
    volume: 0.8,
    fadeIn: 0.02,
    fadeOut: 0.3,
    loop: false,
  },
  laser: {
    src: '/sounds/laser.mp3',
    volume: 0.2,
    fadeIn: 1.5,
    fadeOut: 2.0,
    loop: true,
  },
  ambient: {
    src: '/sounds/sea_sound_2.mp3',
    volume: 0.35,
    fadeIn: 1.5,
    fadeOut: 1.5,
    loop: true,
  },
};

/**
 * useAudio — hook qui gère 3 canaux audio + bouton mute global.
 *
 * Renvoie une API impérative :
 *   playOneShot(name)     → joue explo (etc.) avec fade-in
 *   startChannel(name)    → démarre un loop (laser/ambient)
 *   stopChannel(name)     → coupe un loop avec fade-out
 *
 * L'audio se débloque au premier pointerdown (politique autoplay).
 */
export function useAudio() {
  const stateRef = useRef({
    muted: false,
    unlocked: false,
    channels: {},
    oneShots: [],
    lastT: 0,
    rafId: 0,
  });

  // API stable, jamais recréée → safe à passer en prop.
  const apiRef = useRef(null);

  useEffect(() => {
    const S = stateRef.current;

    // ── Init des canaux loop ────────────────────────────────────────────────
    for (const [name, cfg] of Object.entries(AUDIO_CONFIG)) {
      if (!cfg.loop) continue;
      const el = new Audio(cfg.src);
      el.loop = true;
      el.volume = 0;
      el.preload = 'auto';
      S.channels[name] = { el, cfg, current: 0, playing: false };
    }

    const startChannel = (name) => {
      if (!S.unlocked) return;
      const c = S.channels[name];
      if (!c) return;
      c.playing = true;
      if (c.el.paused) c.el.play().catch(() => {});
    };

    const stopChannel = (name) => {
      const c = S.channels[name];
      if (!c) return;
      c.playing = false;
    };

    const playOneShot = (name) => {
      if (!S.unlocked) return;
      const cfg = AUDIO_CONFIG[name];
      if (!cfg) return;
      const el = new Audio(cfg.src);
      el.volume = 0;
      el.play().catch(() => {});
      const entry = { el, cfg, current: 0 };
      S.oneShots.push(entry);
      el.addEventListener('ended', () => {
        const idx = S.oneShots.indexOf(entry);
        if (idx !== -1) S.oneShots.splice(idx, 1);
      });
    };

    const unlock = () => {
      if (S.unlocked) return;
      S.unlocked = true;
      startChannel('ambient');
    };

    const onPointerDown = () => unlock();
    window.addEventListener('pointerdown', onPointerDown, { once: true });

    // ── Boucle fade in/out (RAF dédié, indépendant du R3F frame loop) ──────
    const tick = (now) => {
      const t  = now / 1000;
      const dt = Math.min(t - S.lastT, 0.1);
      S.lastT = t;

      for (const c of Object.values(S.channels)) {
        const target   = c.playing ? c.cfg.volume : 0;
        const fadeTime = target > c.current ? c.cfg.fadeIn : c.cfg.fadeOut;
        const delta    = (c.cfg.volume / Math.max(0.001, fadeTime)) * dt;
        if (target > c.current) c.current = Math.min(target, c.current + delta);
        else                    c.current = Math.max(target, c.current - delta);
        c.el.volume = S.muted ? 0 : c.current;
        if (c.current <= 0.0005 && !c.playing && !c.el.paused) {
          c.el.pause();
          c.el.currentTime = 0;
        }
      }
      for (const o of S.oneShots) {
        if (o.current < o.cfg.volume) {
          const delta = (o.cfg.volume / Math.max(0.001, o.cfg.fadeIn)) * dt;
          o.current = Math.min(o.cfg.volume, o.current + delta);
        }
        o.el.volume = S.muted ? 0 : o.current;
      }
      S.rafId = requestAnimationFrame(tick);
    };
    S.lastT = performance.now() / 1000;
    S.rafId = requestAnimationFrame(tick);

    // ── Bouton mute UI ──────────────────────────────────────────────────────
    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.textContent = 'SON';
    muteBtn.className = 'mute-btn';
    muteBtn.addEventListener('click', () => {
      S.muted = !S.muted;
      muteBtn.textContent = S.muted ? 'MUET' : 'SON';
      muteBtn.style.opacity = S.muted ? '0.45' : '1';
    });
    document.body.appendChild(muteBtn);

    apiRef.current = { playOneShot, startChannel, stopChannel };

    return () => {
      cancelAnimationFrame(S.rafId);
      window.removeEventListener('pointerdown', onPointerDown);
      muteBtn.remove();
      for (const c of Object.values(S.channels)) {
        c.el.pause();
        c.el.src = '';
      }
    };
  }, []);

  return apiRef;
}
