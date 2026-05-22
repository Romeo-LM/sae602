import { useMemo, useRef } from 'react';
import { CircleGeometry, RepeatWrapping, Vector2 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { WaterSimple } from './Water/WaterSimple';
import { WaterContext } from './WaterContext';

type Props = {
	radius?: number;
	segments?: number;
	waterColor?: string;
	position?: [number, number, number];
	distortionScale?: number;
	size?: number;
	fxDistortionFactor?: number;
	fxDisplayColorAlpha?: number;
	fxMixColor?: string;
	reflectivity?: number;
	children?: React.ReactNode;
};

export default function WaterDisk({
	radius = 40,
	segments = 64,
	waterColor = '#001a33',
	position = [0, 0, 0],
	distortionScale = 3.7,
	size = 10,
	fxDistortionFactor = 0.35,
	fxDisplayColorAlpha = 0.0,
	fxMixColor = '#FFFFFF',
	reflectivity = 0.85,
	children,
}: Props) {
	const ref = useRef<any>();
	const refPointer = useRef(new Vector2(0, 0));

	const gl = useThree((state) => state.gl);
	const waterNormals = useTexture('/water/simple/waternormals.jpeg');
	waterNormals.wrapS = waterNormals.wrapT = RepeatWrapping;

	const geom = useMemo(
		() => new CircleGeometry(radius, segments),
		[radius, segments]
	);

	const config = useMemo(
		() => ({
			textureWidth: 1024,
			textureHeight: 1024,
			waterNormals,
			waterColor,
			distortionScale,
			size,
			fxDistortionFactor,
			fxDisplayColorAlpha,
			fxMixColor,
			reflectivity,
			fog: false,
			format: (gl as any).encoding,
		}),
		[waterNormals, waterColor, distortionScale, size, fxDistortionFactor, fxDisplayColorAlpha, fxMixColor, reflectivity, gl]
	);

	const waterObj = useMemo(() => new WaterSimple(geom, config), [geom, config]);

	useFrame((_, delta) => {
		if (ref.current) ref.current.material.uniforms.time.value += delta;
	});

	const handlePointerMove = (e: any) => {
		refPointer.current = e.uv.clone().multiplyScalar(2).subScalar(1);
	};

	return (
		<WaterContext.Provider value={{ ref, refPointer }}>
			<primitive
				ref={ref}
				object={waterObj}
				rotation-x={-Math.PI / 2}
				position={position}
				onPointerMove={handlePointerMove}
			/>
			{children}
		</WaterContext.Provider>
	);
}
