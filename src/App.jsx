import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useRef } from 'react';
import { Color, MathUtils } from 'three';

import WaterDisk from './WaterDisk';
import RippleFX from './InteractiveFX/RippleFX';
import WaterColorTransition from './InteractiveFX/WaterColorTransition';

import { useScrollProgress } from './HDRTransition/useScrollProgress';
import { TransitionBackground } from './HDRTransition/TransitionBackground';

import { SceneFXProvider, useMouseRefs } from './sceneFX';
import Form from './Form/Form';
import Words from './Words/Words';
import Bursts from './Bursts/Bursts';
import FXMouseHandler from './FXMouseHandler';
import { useAudio } from './audio/useAudio';

// Day → night light colors (refs stables)
const DAY_AMBIENT   = new Color('#e8f1ff');
const NIGHT_AMBIENT = new Color('#1a1530');
const DAY_DIR       = new Color('#ffffff');
const NIGHT_DIR     = new Color('#3030a0');

function SceneLights({ progressRef }) {
  const ambientRef = useRef();
  const dirRef     = useRef();

  useFrame(() => {
    const t = progressRef.current;
    if (ambientRef.current) {
      ambientRef.current.color.lerpColors(DAY_AMBIENT, NIGHT_AMBIENT, t);
      ambientRef.current.intensity = MathUtils.lerp(1.8, 0.4, t);
    }
    if (dirRef.current) {
      dirRef.current.color.lerpColors(DAY_DIR, NIGHT_DIR, t);
      dirRef.current.intensity = MathUtils.lerp(3.0, 0.5, t);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} color='#e8f1ff' intensity={1.8} />
      <directionalLight ref={dirRef} color='#ffffff' intensity={3.0} position={[5, 10, 5]} />
    </>
  );
}

function SceneContent({ progressRef, audioRef }) {
  const formApiRef = useRef(null);
  const mouseRef   = useMouseRefs();
  const burstsRef  = useRef(null);

  const handleWordClicked = (worldPos) => {
    if (burstsRef.current) burstsRef.current.spawn(worldPos);
    audioRef?.current?.playOneShot('explo');
    if (formApiRef.current) formApiRef.current.decrementNoiseStrength(0.05);
  };

  return (
    <>
      <TransitionBackground progressRef={progressRef} />
      <SceneLights progressRef={progressRef} />

      <WaterDisk
        position={[0, 0, 0]}
        radius={50}
        reflectivity={0.85}
        distortionScale={3.7}
        size={10}
        fxDistortionFactor={0.35}
        fxDisplayColorAlpha={0.0}
        waterColor='#001a33'
        fxMixColor='#FFFFFF'
      >
        <RippleFX
          dissipation={0.98}
          pressureIterations={8}
          forceBias={10}
          radius={[0.15, 0.15]}
        />
        <WaterColorTransition progressRef={progressRef} />
      </WaterDisk>

      <Form apiRef={formApiRef} mouseRef={mouseRef} progressRef={progressRef} />
      <Words
        onWordClicked={handleWordClicked}
        progressRef={progressRef}
        formApiRef={formApiRef}
      />
      <Bursts ref={burstsRef} />

      <FXMouseHandler
        formApiRef={formApiRef}
        mouseRef={mouseRef}
        audioRef={audioRef}
      />
    </>
  );
}

function ScrollScene({ audioRef }) {
  const progressRef = useScrollProgress({ damping: 5 });
  return <SceneContent progressRef={progressRef} audioRef={audioRef} />;
}

export default function App() {
  const audioRef = useAudio();

  return (
    <>
      <div className='canvas'>
        <Canvas camera={{ position: [0, 5, 10], fov: 50 }}>
          <Suspense fallback={null}>
            <SceneFXProvider>
              <ScrollScene audioRef={audioRef} />
            </SceneFXProvider>
          </Suspense>
        </Canvas>
      </div>
      <div className='scroll-spacer' aria-hidden='true' />
    </>
  );
}
