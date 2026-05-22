import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useScrollProgress({
  trigger,
  start = 'top top',
  end = 'bottom bottom',
  scrub = 1,
  damping = 5,
} = {}) {
  const target = useRef(0);
  const damped = useRef(0);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: trigger ?? document.body,
      start,
      end,
      scrub,
      onUpdate: (self) => {
        target.current = self.progress;
      },
    });
    ScrollTrigger.refresh();
    return () => st.kill();
  }, [trigger, start, end, scrub]);

  useFrame((_, dt) => {
    if (damping <= 0) {
      damped.current = target.current;
      return;
    }
    const t = 1 - Math.exp(-damping * dt);
    damped.current += (target.current - damped.current) * t;
  });

  return damped;
}
