import { createContext, useContext, useMemo, useRef } from 'react';

// ─── Contexte partagé : uniforms + ring buffer d'impacts ─────────────────────
// Form, Particles et Words lisent les MÊMES références d'uniforms. Toute
// mutation (recordHit, setNoiseStrength) est immédiatement visible.

export const MAX_HITS    = 8;
export const HIT_RADIUS  = 0.55;
export const WATER_Y     = 0.0;   // niveau de l'eau (plan horizontal)
export const FORM_Y      = 3.0;   // hauteur du centre de la forme (au-dessus de l'eau)

const SceneFXContext = createContext(null);

export function SceneFXProvider({ children }) {
  // Float32Array partagés entre tous les ShaderMaterial : un seul upload GPU.
  const value = useMemo(() => {
    const hitPointsData = new Float32Array(MAX_HITS * 3).fill(0);
    const hitTimesData  = new Float32Array(MAX_HITS).fill(-1000);

    const sharedUniforms = {
      u_time:       { value: 0 },
      u_hitPoints:  { value: hitPointsData },
      u_hitTimes:   { value: hitTimesData },
      u_hitRadius:  { value: HIT_RADIUS },
      u_waterY:     { value: WATER_Y },
    };

    return {
      sharedUniforms,
      hitPointsData,
      hitTimesData,
      hitHead: { current: 0 },
      // Bus d'événements simple pour le clic-mot → onWordClicked callbacks
      wordListeners: new Set(),
    };
  }, []);

  return <SceneFXContext.Provider value={value}>{children}</SceneFXContext.Provider>;
}

export function useSceneFX() {
  const ctx = useContext(SceneFXContext);
  if (!ctx) throw new Error('useSceneFX must be used within SceneFXProvider');
  return ctx;
}

// Helper de bas niveau utilisé par le handler de souris.
export function recordHit(fx, point, time) {
  const idx = fx.hitHead.current * 3;
  fx.hitPointsData[idx]     = point.x;
  fx.hitPointsData[idx + 1] = point.y;
  fx.hitPointsData[idx + 2] = point.z;
  fx.hitTimesData[fx.hitHead.current] = time;
  fx.hitHead.current = (fx.hitHead.current + 1) % MAX_HITS;
}

// Hook pratique pour la rotation/tilt souris partagé (Form lit, le handler écrit).
export function useMouseRefs() {
  return useRef({
    ndc: { x: 0, y: 0 },
    onScreen: false,
  });
}
