import React from 'react';

/**
 * Courtyard treasure — a trophy unlock (450 🏆). Decorative chest with
 * spilling gold beside the retreat. No collider: it sits outside the
 * playfield, so it never affects dice physics.
 */
export function TreasureChest() {
  return (
    <group position={[3.7, 0, 8.3]} rotation={[0, -0.5, 0]}>
      {/* Chest body */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.78, 0.44, 0.52]} />
        <meshStandardMaterial color="#8a5a2e" roughness={0.8} />
      </mesh>
      {/* Open lid, tilted back */}
      <mesh position={[0, 0.5, -0.24]} rotation={[-0.9, 0, 0]}>
        <boxGeometry args={[0.78, 0.4, 0.08]} />
        <meshStandardMaterial color="#7a4d24" roughness={0.8} />
      </mesh>
      {/* Gold trim */}
      <mesh position={[0, 0.22, 0.27]}>
        <boxGeometry args={[0.8, 0.08, 0.02]} />
        <meshStandardMaterial color="#e8b93c" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Heap of gold inside + spilled coins */}
      <mesh position={[0, 0.44, 0.02]} scale={[1, 0.55, 0.8]}>
        <sphereGeometry args={[0.3, 12, 8]} />
        <meshStandardMaterial color="#ffd23d" metalness={0.4} roughness={0.35} />
      </mesh>
      {(
        [
          [0.5, 0.35],
          [-0.45, 0.42],
          [0.28, 0.62],
        ] as const
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.035, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.03, 10]} />
          <meshStandardMaterial color="#ffd23d" metalness={0.4} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}
