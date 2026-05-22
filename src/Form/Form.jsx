import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useEnvironment } from '@react-three/drei';
import {
  IcosahedronGeometry,
  BufferAttribute,
  ShaderMaterial,
  Matrix4,
  Vector3,
  MathUtils,
} from 'three';
import vert from './form.vert.glsl?raw';
import frag from './form.frag.glsl?raw';
import { useSceneFX, FORM_Y } from '../sceneFX';

// ─── Tunables (portés de 602/main.js) ────────────────────────────────────────
const NOISE_STRENGTH_START = 0.5;
const OXIDATION_RADIUS     = 0.55;
const OXIDATION_RATE       = 0.25;
const OXIDATION_INIT       = 1.0;
const OXIDATION_RECOVER_DELAY = 5.0;   // seconds before a touched vertex starts oxidizing back
const OXIDATION_RECOVER_RATE  = 0.25;  // units per second once recovery starts

/**
 * Form — icosphère oxydée au centre de la scène (au-dessus de l'eau).
 *
 * Expose 3 APIs au reste de l'arbre via `apiRef` :
 *  - paintOxidation(worldHit) : décape la surface au point world donné
 *  - decrementNoiseStrength()  : appelé par Words.jsx à chaque mot cliqué
 *  - intersectSphere(ray, outVec3) : pour savoir si la souris est sur la forme
 */
export default function Form({ apiRef, mouseRef, progressRef }) {
  const { sharedUniforms } = useSceneFX();
  const envDay   = useEnvironment({ preset: 'dawn' });
  const envNight = useEnvironment({ preset: 'night' });

  const meshRef = useRef();
  const matRef  = useRef();

  // ── Géométrie + attribut d'oxydation persistante ──────────────────────────
  const { geom, formVertCount, formLocalPos, oxidationData, lastTouchedData, dirtyIndices } = useMemo(() => {
    const g = new IcosahedronGeometry(1.0, 6);
    const count = g.attributes.position.count;
    const ox = new Float32Array(count).fill(OXIDATION_INIT);
    g.setAttribute('a_oxidation', new BufferAttribute(ox, 1));
    return {
      geom: g,
      formVertCount: count,
      formLocalPos: g.attributes.position.array,
      oxidationData: ox,
      lastTouchedData: new Float32Array(count),
      dirtyIndices: new Set(),
    };
  }, []);

  // ── Matériau ──────────────────────────────────────────────────────────────
  const material = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        ...sharedUniforms,
        u_noiseStrength:  { value: NOISE_STRENGTH_START },
        u_noiseFrequency: { value: 1.0 },
        u_envMapDay:      { value: null },
        u_envMapNight:    { value: null },
        u_envIntensity:   { value: 1.0 },
        u_progress:       { value: 0 },
      },
    });
    return m;
  }, [sharedUniforms]);

  // Les env arrivent via Suspense de drei → on les injecte dès qu'ils sont dispo.
  useEffect(() => {
    if (envDay)   material.uniforms.u_envMapDay.value   = envDay;
    if (envNight) material.uniforms.u_envMapNight.value = envNight;
  }, [envDay, envNight, material]);

  // ── Painter d'oxydation (CPU) ─────────────────────────────────────────────
  // Hit en world → ramené en local (forme tourne) → loop sur ~10k verts.
  const formInvMatrix   = useMemo(() => new Matrix4(), []);
  const localHit        = useMemo(() => new Vector3(), []);
  const localFormCenter = useMemo(() => new Vector3(0, FORM_Y, 0), []);

  const paintOxidation = (worldHit) => {
    if (!meshRef.current) return;
    formInvMatrix.copy(meshRef.current.matrixWorld).invert();
    // worldHit est en world (peut être au-dessus / autour de la forme).
    // On translate d'abord vers le repère local de la forme (centre FORM_Y),
    // l'inverse matrixWorld gère ça pour nous.
    localHit.copy(worldHit).applyMatrix4(formInvMatrix).normalize();

    const hx = localHit.x;
    const hy = localHit.y;
    const hz = localHit.z;
    const r  = OXIDATION_RADIUS;
    const r2 = r * r;
    const now = sharedUniforms.u_time.value;

    for (let i = 0; i < formVertCount; i++) {
      const j  = i * 3;
      const dx = formLocalPos[j]     - hx;
      const dy = formLocalPos[j + 1] - hy;
      const dz = formLocalPos[j + 2] - hz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      const falloff = 1.0 - Math.sqrt(d2) / r;
      const sub     = OXIDATION_RATE * falloff * falloff;
      const next    = oxidationData[i] - sub;
      oxidationData[i] = next < 0.0 ? 0.0 : next;
      lastTouchedData[i] = now;
      dirtyIndices.add(i);
    }
    geom.attributes.a_oxidation.needsUpdate = true;
  };

  // ── Decrement noise strength quand un mot est cliqué (Words appelle ça) ──
  const decrementNoiseStrength = (step = 0.05) => {
    const u = material.uniforms.u_noiseStrength;
    u.value = Math.max(0, u.value - step);
  };

  const getNoiseStrength = () => material.uniforms.u_noiseStrength.value;

  // Expose l'API au parent via apiRef.
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      paintOxidation,
      decrementNoiseStrength,
      getNoiseStrength,
      meshRef,
    };
  });

  // ── Animation : rotation auto + tilt souris ───────────────────────────────
  const targetRot = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    sharedUniforms.u_time.value = t;
    if (progressRef) material.uniforms.u_progress.value = progressRef.current;

    // ── Re-oxydation progressive : ~3s après avoir été touché, la surface revient à 1.0
    if (dirtyIndices.size > 0) {
      const recoverStep = OXIDATION_RECOVER_RATE * delta;
      let mutated = false;
      for (const i of dirtyIndices) {
        if (t - lastTouchedData[i] < OXIDATION_RECOVER_DELAY) continue;
        const next = oxidationData[i] + recoverStep;
        if (next >= OXIDATION_INIT) {
          oxidationData[i] = OXIDATION_INIT;
          dirtyIndices.delete(i);
        } else {
          oxidationData[i] = next;
        }
        mutated = true;
      }
      if (mutated) geom.attributes.a_oxidation.needsUpdate = true;
    }

    if (!meshRef.current) return;

    const mx = mouseRef.current.onScreen ? mouseRef.current.ndc.x : 0;
    const my = mouseRef.current.onScreen ? mouseRef.current.ndc.y : 0;
    targetRot.current.x += (my * 0.12 - targetRot.current.x) * 0.03;
    targetRot.current.y += (mx * 0.12 - targetRot.current.y) * 0.03;

    meshRef.current.rotation.y = t * 0.07 + targetRot.current.y;
    meshRef.current.rotation.x = Math.sin(t * 0.04) * 0.12 + targetRot.current.x;
    meshRef.current.updateMatrixWorld();
  });

  return (
    <mesh ref={meshRef} position={[0, FORM_Y, 0]} geometry={geom} material={material} />
  );
}
