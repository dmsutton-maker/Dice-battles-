import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { MOAT } from '../game/obstacles';
import { buildMound, buildPit, BuiltHazard, isWaterPit } from './hazardShapes';
import { ObstacleLook } from './obstacleLooks';
import { LIVE, troughOf, WaterSurface } from './water';

/**
 * The bump and the pit, drawn as this board's own hazards. The shapes are
 * built in hazardShapes.ts (plain three.js, so the tests can build every one);
 * these components only own their lifetime.
 *
 * No frame loop of their own. Anything that moves — lava, a blinking
 * beacon, a spinning fan — runs on the shared water clock through LIVE,
 * so this file stays loadable by the headless tests and the arena
 * preview, and costs nothing extra per frame. The springs (the pit's
 * gulp, the bump's squash) are driven from DiceScene's own frame loop
 * through `springRef`, because that is where the moment a die goes in is
 * known.
 */

/** Build once per look, register what animates, free it all on unmount. */
function useBuilt(build: () => BuiltHazard, key: string): BuiltHazard {
  // The look is a fresh object per render for some callers; what it says
  // is what matters, so the key is built from its values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const built = useMemo(build, [key]);
  useEffect(() => {
    for (const m of built.live) LIVE.add(m);
    return () => {
      for (const m of built.live) LIVE.delete(m);
      built.dispose();
    };
  }, [built]);
  return built;
}

export function Mound({
  look,
  position,
  springRef,
}: {
  look: ObstacleLook;
  /** Where its middle sits on the floor (y is the floor, normally 0). */
  position: [number, number, number];
  springRef?: React.RefObject<THREE.Group | null>;
}) {
  const m = look.mound;
  const built = useBuilt(() => buildMound(m), JSON.stringify(m));
  return (
    <group position={position} ref={springRef}>
      <primitive object={built.group} />
    </group>
  );
}

export function Pit({
  look,
  springRef,
}: {
  look: ObstacleLook;
  springRef?: React.RefObject<THREE.Group | null>;
}) {
  const p = look.pit;
  const built = useBuilt(() => buildPit(p), JSON.stringify(p));
  return (
    <group ref={springRef}>
      {isWaterPit(p.kind) && (
        <>
          {/* Dark depths below, so a sinking die silhouettes against it */}
          <mesh position={[0, -1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[MOAT.size + 0.3, MOAT.size + 0.3]} />
            <meshBasicMaterial color={p.depths} />
          </mesh>
          {/*
            REAL WATER, MOVING. David, 30 Sep 2026: "I don't like that
            diamond instead I wanna see the water moving in all the
            ponds flowing maybe some little waves in there." Waves, a
            slow current, light on the crests and foam lapping at the
            square edge — see src/arena/water.tsx.

            Nearly solid. It used to be 62% see-through, and all that
            ever showed through it was the floor tiles: a sinking die
            goes under the floor, not under the water.
          */}
          <WaterSurface
            look={{
              shallow: p.surface,
              deep: troughOf(p.surface),
              foam: p.edge,
              opacity: 0.94,
            }}
            shape="square"
            size={[MOAT.size + 0.1, MOAT.size + 0.1]}
            flow={[0.14, 0.08]}
            position={[0, 0.03, 0]}
          />
        </>
      )}
      <primitive object={built.group} />
    </group>
  );
}
