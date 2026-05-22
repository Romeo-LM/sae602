import { useContext, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import { WaterContext } from '../WaterContext';

type Props = {
  progressRef: React.MutableRefObject<number>;
  dayColor?: string;
  nightColor?: string;
};

const _lerped = new Color();

export default function WaterColorTransition({
  progressRef,
  dayColor = '#001a33',
  nightColor = '#0d0020',
}: Props) {
  const { ref } = useContext(WaterContext);
  const day   = useMemo(() => new Color(dayColor),   [dayColor]);
  const night = useMemo(() => new Color(nightColor), [nightColor]);

  useFrame(() => {
    const mat = (ref.current as any)?.material;
    if (!mat?.uniforms?.waterColor) return;
    _lerped.lerpColors(day, night, progressRef.current);
    mat.uniforms.waterColor.value.copy(_lerped);
  });

  return null;
}
