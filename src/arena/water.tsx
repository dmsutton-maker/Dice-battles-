import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Water that moves.
 *
 * David, 30 Sep 2026: "On old boards that have the water trap I don't
 * like that diamond instead I wanna see the water moving in all the
 * ponds flowing maybe some little waves in there something to show that
 * it's real water."
 *
 * Every pond, pool, lagoon and river used to be one flat colour, and the
 * moat had a foam ring drawn as a ringGeometry with FOUR segments — which
 * is not a square, it is a diamond, sitting at 45 degrees to the square
 * hole it was meant to outline. This is one shader for all of them:
 * two wave trains crossing over a drifting noise, a slow current, light
 * catching the crests, and foam lapping at the edge — the square edge of
 * a moat, or the round edge of a pond.
 *
 * Pure three.js, so it ships over the air like everything else here.
 *
 * TIME. Every water surface registers its material here, and one
 * `WaterClock` (waterClock.tsx) in the scene advances them all each frame. A surface in a
 * scene with no clock (the arena preview tool) simply holds still.
 */

export interface WaterLook {
  /** The colour at the top of a wave. */
  shallow: string;
  /** The colour in the troughs. */
  deep: string;
  /** The foam at the edge. */
  foam: string;
  /** 1 is solid; a moat is see-through so a sinking die shows. */
  opacity: number;
}

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform float uOpacity;
  uniform vec2 uSize;
  uniform float uRound;
  uniform vec2 uFlow;
  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  /*
    Distance to the nearest edge between moving cells (Worley noise,
    F2 - F1). Its thin bright lines are the classic look of sunlight
    caught by ripples on shallow water, and the cells drift and wobble so
    the lines shimmer rather than sitting still.
  */
  float cells(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash2(i + g);
        // Kept inside the cell's own square, so the 3x3 search always
        // finds the true nearest two — wider, and the lines tear.
        o = 0.5 + 0.3 * sin(t * 0.9 + 6.2831 * o);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
    return sqrt(d2) - sqrt(d1);
  }

  void main() {
    // Work in world units, so a pond and a moat have ripples the same size.
    vec2 p = vUv * uSize;
    float t = uTime;
    // The current carries the whole pattern along.
    vec2 q = p - uFlow * t;

    // Broad, slow swells of deeper and lighter water.
    float swell = 0.5 + 0.3 * sin(q.x * 1.7 + t * 0.8) + 0.3 * sin(q.y * 2.1 - t * 0.6 + q.x * 0.6);
    vec3 color = mix(uDeep, uShallow, smoothstep(0.1, 0.9, swell));

    // A gentle wobble, so the light lines ripple instead of lying still.
    vec2 wq = q + 0.1 * vec2(sin(q.y * 2.7 + t * 1.3), sin(q.x * 2.3 - t * 1.1));
    // Two layers of rippled light, drifting different ways — soft, so
    // from the game's high camera they read as light on water rather
    // than as cracks.
    float near = 1.0 - smoothstep(0.0, 0.1, cells(wq * 2.2, t));
    float far = 1.0 - smoothstep(0.0, 0.12, cells(wq * 3.6 + vec2(t * 0.12, -t * 0.08) + 7.0, t * 1.3));
    color = mix(color, vec3(1.0), clamp(near * 0.36 + far * 0.14, 0.0, 0.6));

    // Distance to the edge in world units, square or round.
    float edge;
    if (uRound > 0.5) {
      edge = (0.5 - length(vUv - 0.5)) * min(uSize.x, uSize.y);
    } else {
      edge = min(min(vUv.x, 1.0 - vUv.x) * uSize.x, min(vUv.y, 1.0 - vUv.y) * uSize.y);
    }
    // Foam that laps in and out rather than sitting still.
    float lap = 0.08 + 0.03 * sin(t * 1.6 + (vUv.x + vUv.y) * 9.0) + 0.02 * sin(t * 2.3 - (vUv.x - vUv.y) * 13.0);
    float foam = 1.0 - smoothstep(lap * 0.45, lap, edge);
    color = mix(color, uFoam, foam * 0.85);

    gl_FragColor = vec4(color, mix(uOpacity, 1.0, foam * 0.8));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Every water material currently in a scene. Advanced each frame by
 * WaterClock (waterClock.tsx), which lives in its own file because it
 * needs the renderer's frame loop, and the arena files that draw water
 * must stay loadable by the headless tests.
 */
export const LIVE = new Set<THREE.ShaderMaterial>();

/** A darker, richer version of a water colour, for the troughs. */
export function troughOf(hex: string, depth = 0.4): string {
  return `#${new THREE.Color(hex).lerp(new THREE.Color('#06121c'), depth).getHexString()}`;
}

export function createWaterMaterial(
  look: WaterLook,
  shape: 'square' | 'round',
  size: [number, number],
  flow: [number, number] = [0.12, 0.06],
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color(look.shallow) },
      uDeep: { value: new THREE.Color(look.deep) },
      uFoam: { value: new THREE.Color(look.foam) },
      uOpacity: { value: look.opacity },
      uSize: { value: new THREE.Vector2(size[0], size[1]) },
      uRound: { value: shape === 'round' ? 1 : 0 },
      uFlow: { value: new THREE.Vector2(flow[0], flow[1]) },
    },
    transparent: look.opacity < 1,
    depthWrite: look.opacity >= 1,
  });
}

/**
 * A flat surface of moving water, lying in the ground plane.
 *
 * `size` is [width, depth] for a square, or [diameter, diameter] for a
 * round one. Rotate the group it sits in to turn a river.
 */
export function WaterSurface({
  look,
  shape,
  size,
  flow,
  position,
  rotationZ = 0,
  renderOrder,
}: {
  look: WaterLook;
  shape: 'square' | 'round';
  size: [number, number];
  flow?: [number, number];
  position: [number, number, number];
  rotationZ?: number;
  renderOrder?: number;
}) {
  const material = useMemo(
    () => createWaterMaterial(look, shape, size, flow),
    // The look is a fresh object on every render of most callers; its
    // values are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [look.shallow, look.deep, look.foam, look.opacity, shape, size[0], size[1], flow?.[0], flow?.[1]],
  );
  useEffect(() => {
    LIVE.add(material);
    return () => {
      LIVE.delete(material);
      material.dispose();
    };
  }, [material]);

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, rotationZ]}
      material={material}
      renderOrder={renderOrder}
    >
      {shape === 'round' ? (
        <circleGeometry args={[size[0] / 2, 40]} />
      ) : (
        <planeGeometry args={[size[0], size[1]]} />
      )}
    </mesh>
  );
}

/** How many water surfaces are live — for the tests. */
export function liveWaterCount(): number {
  return LIVE.size;
}
