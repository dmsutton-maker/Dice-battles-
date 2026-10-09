import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect } from 'react';
import { LIVE } from './water';

/**
 * Keeps every water surface in the scene moving. One per canvas.
 *
 * `idle`: the board is otherwise asleep (`frameloop: 'demand'`, see
 * DiceDemoScreen) and only the water wants drawing. Then this asks for a
 * frame twenty times a second rather than the loop's sixty — water
 * moves slowly, and a third of the frames is a third of the battery.
 */
export function WaterClock({ idle = false }: { idle?: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const m of LIVE) m.uniforms.uTime.value = t;
  });
  useEffect(() => {
    if (!idle) return;
    const id = setInterval(() => invalidate(), WATER_IDLE_FRAME_MS);
    return () => clearInterval(id);
  }, [idle, invalidate]);
  return null;
}

/** How often the idle water is redrawn: twenty frames a second. */
export const WATER_IDLE_FRAME_MS = 50;


