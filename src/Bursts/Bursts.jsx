import { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Points,
  Color,
  AdditiveBlending,
} from 'three';

const BURST_COUNT    = 50;
const BURST_LIFETIME = 1.2;
const BURST_SPEED    = 1.6;
const BURST_DAMPING  = 0.94;
const BURST_COLOR    = new Color(1, 1, 1);

/**
 * Bursts — gère des explosions de particules temporaires.
 * Appelle `burstsRef.current.spawn(worldVec3)` pour en émettre une.
 */
const Bursts = forwardRef(function Bursts(_, ref) {
  const { scene, clock } = useThree((s) => ({ scene: s.scene, clock: s.clock }));
  const activeRef = useRef([]);
  const groupRef = useRef();

  // Référence stable au tableau interne (les bursts sont des Points ajoutés à la scène).
  const active = activeRef.current;

  useImperativeHandle(ref, () => ({
    spawn(origin) {
      const t = clock.getElapsedTime();
      const geo = new BufferGeometry();
      const pos = new Float32Array(BURST_COUNT * 3);
      const vel = new Float32Array(BURST_COUNT * 3);

      for (let i = 0; i < BURST_COUNT; i++) {
        pos[i * 3]     = origin.x;
        pos[i * 3 + 1] = origin.y;
        pos[i * 3 + 2] = origin.z;
        const phi   = Math.acos(2.0 * Math.random() - 1.0);
        const theta = Math.random() * Math.PI * 2.0;
        const s     = BURST_SPEED * (0.35 + Math.random() * 0.65);
        vel[i * 3]     = Math.sin(phi) * Math.cos(theta) * s;
        vel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * s;
        vel[i * 3 + 2] = Math.cos(phi)                    * s;
      }

      geo.setAttribute('position', new BufferAttribute(pos, 3));

      const mat = new PointsMaterial({
        color:       BURST_COLOR,
        size:        0.09,
        transparent: true,
        opacity:     1.0,
        depthWrite:  false,
        blending:    AdditiveBlending,
        sizeAttenuation: true,
      });

      const points = new Points(geo, mat);
      points.renderOrder = -1;
      scene.add(points);
      active.push({ points, vel, startTime: t });
    },
  }), [scene, clock, active]);

  useFrame((state, dt) => {
    const t = state.clock.getElapsedTime();
    for (let i = active.length - 1; i >= 0; i--) {
      const b   = active[i];
      const age = t - b.startTime;
      if (age >= BURST_LIFETIME) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        active.splice(i, 1);
        continue;
      }
      const pos = b.points.geometry.attributes.position.array;
      for (let j = 0; j < BURST_COUNT; j++) {
        pos[j * 3]     += b.vel[j * 3]     * dt;
        pos[j * 3 + 1] += b.vel[j * 3 + 1] * dt;
        pos[j * 3 + 2] += b.vel[j * 3 + 2] * dt;
        b.vel[j * 3]     *= BURST_DAMPING;
        b.vel[j * 3 + 1] *= BURST_DAMPING;
        b.vel[j * 3 + 2] *= BURST_DAMPING;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      const lifeRatio = age / BURST_LIFETIME;
      b.points.material.opacity = Math.pow(1.0 - lifeRatio, 1.6);
    }
  });

  return <group ref={groupRef} />;
});

export default Bursts;
