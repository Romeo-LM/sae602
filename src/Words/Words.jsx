import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ShaderMaterial, AdditiveBlending, Vector3 } from 'three';
import vert from './word.vert.glsl?raw';
import frag from './word.frag.glsl?raw';
import { makeWordTexture } from './makeWordTexture';
import { useSceneFX, FORM_Y, WATER_Y } from '../sceneFX';

const WORD_LIST = [
  'Rupture', 'Bouleversement', 'Soumission', 'Conflit', 'Insurrection',
  'Hégémonie', 'Schisme', 'Aliénation', 'Oppression', 'Vassalité',
];

const WORD_WIDTH    = 2.2;   // ↑ plus grands qu'avant (1.3)
const WORD_HEIGHT   = 0.55;  // ratio 4:1 conservé
const WORD_DRIFT    = 0.2;
const WORD_MIN_R    = 2.8;   // ↑ éloignés de la forme (avant 1.6)
const WORD_MAX_R    = 4.8;   // ↑ (avant 3.0)
const WORD_MIN_Y    = WATER_Y + WORD_HEIGHT * 0.5 + 0.2;  // marge anti-eau

// Choisit une position autour de la forme, au-dessus de l'eau.
function pickPosition() {
  for (let i = 0; i < 30; i++) {
    const r     = WORD_MIN_R + Math.random() * (WORD_MAX_R - WORD_MIN_R);
    const phi   = Math.acos(2.0 * Math.random() - 1.0);
    const theta = Math.random() * Math.PI * 2.0;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = FORM_Y + r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.sin(theta);
    if (y >= WORD_MIN_Y) return [x, y, z];
  }
  // Fallback : force l'hémisphère sup
  const r = WORD_MIN_R + Math.random() * 0.5;
  const theta = Math.random() * Math.PI * 2.0;
  return [r * Math.cos(theta), FORM_Y + r * 0.5, r * Math.sin(theta)];
}

const WORD_CLICK_OPACITY = 0.08;
const WORD_RESPAWN_DELAY = 1.6; // s — burst lasts 1.2s, leave a beat of empty space

function Word({ word, basePos, phase, period, onClick, progressRef, fadeIn }) {
  const { sharedUniforms } = useSceneFX();
  const meshRef = useRef();
  const matRef  = useRef();
  const opacityRef = useRef(0);
  const camera  = useThree((s) => s.camera);

  const texture = useMemo(() => makeWordTexture(word), [word]);
  const spawnTRef = useRef(null);

  const material = useMemo(() => new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uMap:     { value: texture },
      uOpacity: { value: 0 },
      u_waterY: sharedUniforms.u_waterY,
    },
    transparent: true,
    depthWrite:  false,
    blending:    AdditiveBlending,
  }), [texture, sharedUniforms]);

  useEffect(() => {
    matRef.current = material;
    return () => {
      material.dispose();
      texture.dispose();
    };
  }, [material, texture]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    if (spawnTRef.current === null) spawnTRef.current = t;

    // Pour un mot ré-apparu, on repart d'opacité 0 et on remonte ; les mots
    // initiaux gardent leur phase aléatoire pour rester désynchronisés.
    const localT = fadeIn ? (t - spawnTRef.current) : t;
    const cycle = ((localT + phase) % period) / period;
    const baseOpacity = Math.pow(Math.sin(cycle * Math.PI), 1.5) * 0.85;
    const nightMix = progressRef ? Math.max(0, Math.min(1, progressRef.current)) : 1;
    const finalOpacity = baseOpacity * nightMix;
    material.uniforms.uOpacity.value = finalOpacity;
    opacityRef.current = finalOpacity;

    // Dérive oscillante (clamp Y > seuil anti-eau)
    const dx = Math.sin(t * 0.13 + phase)        * WORD_DRIFT;
    const dy = Math.cos(t * 0.09 + phase * 1.37) * WORD_DRIFT;
    meshRef.current.position.x = basePos[0] + dx;
    meshRef.current.position.y = Math.max(WORD_MIN_Y, basePos[1] + dy);
    meshRef.current.position.z = basePos[2];

    // Toujours face caméra → raycast natif fiable + visuel propre
    meshRef.current.lookAt(camera.position);
  });

  const handleClick = (e) => {
    if (opacityRef.current < WORD_CLICK_OPACITY) return;
    e.stopPropagation();
    onClick(new Vector3().copy(meshRef.current.position));
  };

  return (
    <mesh
      ref={meshRef}
      position={basePos}
      onClick={handleClick}
      renderOrder={-2}
    >
      <planeGeometry args={[WORD_WIDTH, WORD_HEIGHT]} />
      <primitive object={material} attach='material' />
    </mesh>
  );
}

export default function Words({ onWordClicked, progressRef, formApiRef }) {
  // Liste mutable des mots vivants. On les filtre au clic.
  const [items, setItems] = useState(() =>
    WORD_LIST.map((word) => ({
      word,
      basePos: pickPosition(),
      phase:  Math.random() * Math.PI * 2,
      period: 3.0 + Math.random() * 4.0,   // ↓ cycle plus rapide (avant 8-22s)
      fadeIn: false,
    }))
  );

  const respawnTimers = useRef(new Map());
  useEffect(() => () => {
    respawnTimers.current.forEach((id) => clearTimeout(id));
    respawnTimers.current.clear();
  }, []);

  // Au clic : burst/son/decrement, on retire le mot, puis on le re-spawn
  // ailleurs après un délai (sinon il pop instantanément à l'écran).
  const handleClick = (word, worldPos) => {
    onWordClicked?.(worldPos);
    setItems((prev) => prev.filter((it) => it.word !== word));

    const noise = formApiRef?.current?.getNoiseStrength?.() ?? 1;
    if (noise <= 0) {
      // Noise vient d'atteindre 0 : on annule aussi les re-spawns programmés
      // par les clics précédents pour éviter qu'ils ne ré-apparaissent.
      respawnTimers.current.forEach((id) => clearTimeout(id));
      respawnTimers.current.clear();
      return;
    }

    const prevTimer = respawnTimers.current.get(word);
    if (prevTimer) clearTimeout(prevTimer);
    const id = setTimeout(() => {
      respawnTimers.current.delete(word);
      // Re-vérifier au moment du re-spawn : un autre clic a pu mettre noise à 0
      // entre-temps.
      const noiseNow = formApiRef?.current?.getNoiseStrength?.() ?? 1;
      if (noiseNow <= 0) return;
      setItems((prev) => {
        if (prev.some((it) => it.word === word)) return prev;
        return [...prev, {
          word,
          basePos: pickPosition(),
          phase:  0,   // fadeIn=true → cycle démarre à 0 (mot invisible puis remonte)
          period: 3.0 + Math.random() * 4.0,
          fadeIn: true,
        }];
      });
    }, WORD_RESPAWN_DELAY * 1000);
    respawnTimers.current.set(word, id);
  };

  return (
    <>
      {items.map((it) => (
        <Word
          key={it.word}
          word={it.word}
          basePos={it.basePos}
          phase={it.phase}
          period={it.period}
          fadeIn={it.fadeIn}
          progressRef={progressRef}
          onClick={(pos) => handleClick(it.word, pos)}
        />
      ))}
    </>
  );
}
