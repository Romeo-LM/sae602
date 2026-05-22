import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, Plane, Sphere } from 'three';
import { recordHit, useSceneFX, FORM_Y } from './sceneFX';

const HIT_THROTTLE = 4;

/**
 * FXMouseHandler — composant invisible. Surveille la souris, écrit dans :
 *  - mouseRef.current  (ndc + onScreen) → lu par Form pour la rotation
 *  - sharedUniforms hits via recordHit() → consommé par Form/Particles
 *  - apiRef.current.paintOxidation()    → quand la souris est sur la forme
 *  - audio.startChannel('laser')        → quand la souris hover la forme
 */
export default function FXMouseHandler({ formApiRef, mouseRef, audioRef }) {
  const fx = useSceneFX();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const raycaster = useMemo(() => new Raycaster(), []);
  const mouseNDC  = useMemo(() => new Vector2(9999, 9999), []);
  const hitPlane  = useMemo(() => new Plane(new Vector3(0, 0, 1), 0), []);
  const hitPoint  = useMemo(() => new Vector3(), []);
  const formCenter = useMemo(() => new Vector3(0, FORM_Y, 0), []);
  const formSphere = useMemo(() => new Sphere(formCenter, 1.0), []);
  const sphereHit  = useMemo(() => new Vector3(), []);
  const camDir     = useMemo(() => new Vector3(), []);

  const frameRef = useRef(0);

  // Listeners globaux (préserve le pointermove même en dehors du canvas).
  useEffect(() => {
    const onMove = (e) => {
      mouseRef.current.onScreen = true;
      mouseRef.current.ndc.x =  (e.clientX / window.innerWidth)  * 2 - 1;
      mouseRef.current.ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseNDC.x = mouseRef.current.ndc.x;
      mouseNDC.y = mouseRef.current.ndc.y;
    };
    const onLeave = () => {
      mouseRef.current.onScreen = false;
      mouseNDC.set(9999, 9999);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [mouseRef, mouseNDC]);

  useFrame((state) => {
    frameRef.current++;
    if (!mouseRef.current.onScreen) {
      audioRef?.current?.stopChannel('laser');
      return;
    }

    const t = state.clock.getElapsedTime();

    // Plan perpendiculaire à la caméra passant par le centre de la forme.
    // → quand la souris passe près de la forme, le hit world est proche d'elle.
    camera.getWorldDirection(camDir);
    hitPlane.setFromNormalAndCoplanarPoint(camDir.clone().negate(), formCenter);

    raycaster.setFromCamera(mouseNDC, camera);

    // Détection hover forme (pour le laser audio + painter d'oxydation).
    const onForm = raycaster.ray.intersectSphere(formSphere, sphereHit) !== null;
    if (onForm) audioRef?.current?.startChannel('laser');
    else        audioRef?.current?.stopChannel('laser');

    if (frameRef.current % HIT_THROTTLE === 0) {
      if (raycaster.ray.intersectPlane(hitPlane, hitPoint)) {
        recordHit(fx, hitPoint, t);
      }
      if (onForm && formApiRef.current?.paintOxidation) {
        formApiRef.current.paintOxidation(sphereHit);
      }
    }
  });

  return null;
}
