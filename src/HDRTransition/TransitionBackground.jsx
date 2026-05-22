import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide } from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Jour éclairci (blanc brumeux) ↔ nuit violette
const fragmentShader = /* glsl */ `
  uniform float uProgress;
  varying vec3 vDir;

  float smootherstep(float t) {
    t = clamp(t, 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  void main() {
    vec3 d = normalize(vDir);
    float tSky = clamp(d.y, 0.0, 1.0);
    float tSkySmooth = tSky * tSky * (3.0 - 2.0 * tSky);

    // Jour : blanc brumeux — #eaf2ff zénith → #ffffff horizon
    vec3 dayZenith    = vec3(0.918, 0.949, 1.000);
    vec3 dayHorizon   = vec3(1.000, 1.000, 1.000);
    // Nuit : violet profond — #050010 zénith → #1a0040 horizon
    vec3 nightZenith  = vec3(0.020, 0.000, 0.063);
    vec3 nightHorizon = vec3(0.102, 0.000, 0.251);

    vec3 daySky   = mix(dayHorizon,   dayZenith,   tSkySmooth);
    vec3 nightSky = mix(nightHorizon, nightZenith, tSkySmooth);

    float p = smootherstep(uProgress);
    vec3 col = mix(daySky, nightSky, p);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function TransitionBackground({ progressRef }) {
  const matRef = useRef();
  const uniforms = useMemo(() => ({ uProgress: { value: 0 } }), []);

  useFrame(() => {
    if (matRef.current) matRef.current.uniforms.uProgress.value = progressRef.current;
  });

  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[500, 64, 32]} />
      <shaderMaterial
        ref={matRef}
        side={BackSide}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
        depthTest={false}
        toneMapped
      />
    </mesh>
  );
}
