import React, { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';

/** Where one copy of a repeated piece goes. */
export interface Placement {
  position: [number, number, number];
  rotation?: [number, number, number];
  /** Euler order for `rotation`. 'YXZ' tilts first and then turns, which is
   *  what a leaf or a flag wants: lean it, then point it. */
  order?: THREE.EulerOrder;
  /** A number scales evenly; a triple scales each axis. */
  scale?: number | [number, number, number];
  /** Per-copy tint, multiplied into the material's own colour. */
  color?: THREE.ColorRepresentation;
}

/**
 * Many copies of one piece in ONE draw call.
 *
 * The bespoke walls are built from hundreds of identical parts — merlons,
 * ruin blocks, bamboo nodes, hull plates, ivy — and a mesh each would be
 * hundreds of draw calls for a phone to issue every frame the board is
 * drawn. An InstancedMesh draws them all at once.
 *
 * The geometry and material go in as JSX children, so React owns them and
 * frees them on unmount like any other JSX geometry. The placements are
 * written once when `items` changes and never per frame; `items` must be
 * memoised by the caller or every render would rewrite them.
 */
export function Instanced({
  items,
  children,
}: {
  items: readonly Placement[];
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    items.forEach((it, i) => {
      position.set(...it.position);
      const [rx, ry, rz] = it.rotation ?? [0, 0, 0];
      euler.set(rx, ry, rz, it.order ?? 'XYZ');
      quaternion.setFromEuler(euler);
      if (typeof it.scale === 'number') scale.setScalar(it.scale);
      else if (it.scale) scale.set(...it.scale);
      else scale.setScalar(1);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      if (it.color !== undefined) mesh.setColorAt(i, color.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      // The copies span the whole arena; culling them against one
      // geometry's bounds would drop pieces that are plainly on screen.
      frustumCulled={false}
    >
      {children}
    </instancedMesh>
  );
}
