import { useFluid } from '@funtech-inc/use-shader-fx';
import { useFrame, useThree } from '@react-three/fiber';
import { useContext } from 'react';
import { Vector2 } from 'three';
import { WaterContext } from '../WaterContext';

export type FXRippleProps = {
	dissipation?: number;
	pressureIterations?: number;
	forceBias?: number;
	radius?: [number, number];
};

export default function RippleFX({
	dissipation = 0.98,
	pressureIterations = 8,
	forceBias = 10,
	radius = [0.15, 0.15],
}: FXRippleProps) {
	const { ref: materialRef } = useContext(WaterContext);

	const { size, dpr } = useThree((state) => ({
		size: state.size,
		dpr: state.viewport.dpr,
	}));

	const { render: renderFluid } = useFluid({
		size,
		dpr,
		dissipation,
		pressureIterations,
		forceBias,
		radius: new Vector2(...radius),
	});

	useFrame((state) => {
		const fx = renderFluid(state);
		materialRef.current!.material.uniforms.u_fx.value = fx;
	});

	return null;
}
