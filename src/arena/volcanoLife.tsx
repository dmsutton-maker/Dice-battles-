import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { track } from './boardLife';
import { useSceneryTick } from './sceneryClock';
import { cachedTexture } from './textureCache';

/**
 * Volcano Rim: the lava river, 19 Oct 2026.
 *
 * David: "On the volcano, let me see a river of lava flowing around it
 * and take away the fighting people."
 *
 * A river of lava runs right round the outside of the rim: down both
 * sides, behind the far wall and across the front between the wall and
 * the landing pads. It is one ribbon of geometry laid on the ground
 * along a rounded rectangle, with a painted lava texture — dark crust
 * with bright orange and yellow streaks — SLID along it by a scenery
 * tick, so the lava flows. Moving a picture costs the GPU nothing; the
 * tick writes one number (sceneryClock.ts). Clockwise seen from above,
 * so it flows toward the player down the left side and away up the
 * right.
 *
 * The rocks and lava pools along the edges stand on its banks, and the
 * fighters are gone from this board (themeData.ts): nobody fights
 * beside a lava river.
 */

/** The river's centre line: a rounded rectangle just outside the props. */
const HALF = 3.8;
const FAR = -9.75;
const NEAR = 5.65;
const CORNER = 0.7;
/** Half the river's width. */
const WIDTH = 0.28;
/** Sections round the loop; enough that the corners are round. */
const SECTIONS = 200;
/** How many world units one repeat of the lava texture covers. */
const REPEAT = 2.4;
/** Flow, in texture repeats per second. */
const FLOW = 0.09;

const TEX_W = 128;
const TEX_H = 16;

function hash(x: number, y: number): number {
  return Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
}

/** Value noise that tiles in x with period `px` and in y with `py`. */
function tiledNoise(x: number, y: number, px: number, py: number, cell: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const nx = px / cell;
  const ny = py / cell;
  const c = (ix: number, iy: number) => hash(((ix % nx) + nx) % nx, ((iy % ny) + ny) % ny);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = c(gx, gy) + (c(gx + 1, gy) - c(gx, gy)) * sx;
  const b = c(gx, gy + 1) + (c(gx + 1, gy + 1) - c(gx, gy + 1)) * sx;
  return a + (b - a) * sy;
}

/** Dark crust with streaks of hot orange and yellow running along it. */
function lavaTexture(): THREE.Texture {
  const data = new Uint8Array(TEX_W * TEX_H * 4);
  for (let y = 0; y < TEX_H; y++) {
    for (let x = 0; x < TEX_W; x++) {
      // Streaks: long in x, short in y, two scales.
      const n = tiledNoise(x, y * 6, TEX_W, TEX_H * 6, 32) * 0.6 + tiledNoise(x * 2, y * 8, TEX_W * 2, TEX_H * 8, 16) * 0.4;
      // Cooler at the banks.
      const bank = 1 - Math.pow(Math.abs((y + 0.5) / TEX_H - 0.5) * 2, 3);
      // Mostly crust, with the hot streaks where the noise peaks; a
      // river that is all bright orange reads as a painted band, not
      // as lava with a skin on it.
      const heat = Math.min(1, Math.max(0, (n - 0.42) * 2.6)) * bank;
      let r: number;
      let g: number;
      let b: number;
      if (heat < 0.35) {
        const k = heat / 0.35;
        r = 40 + (200 - 40) * k;
        g = 8 + (60 - 8) * k;
        b = 0;
      } else if (heat < 0.75) {
        const k = (heat - 0.35) / 0.4;
        r = 200 + (255 - 200) * k;
        g = 60 + (140 - 60) * k;
        b = 0 + 30 * k;
      } else {
        const k = (heat - 0.75) / 0.25;
        r = 255;
        g = 140 + (225 - 140) * k;
        b = 30 + (90 - 30) * k;
      }
      const i = (y * TEX_W + x) * 4;
      data[i] = Math.round(r);
      data[i + 1] = Math.round(g);
      data[i + 2] = Math.round(b);
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, TEX_W, TEX_H);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const P = new THREE.Vector3();

/** A ribbon along the loop, `w` either side of the centre line, u along it. */
function ribbon(w: number): THREE.BufferGeometry {
  const positions = new Float32Array((SECTIONS + 1) * 2 * 3);
  const uvs = new Float32Array((SECTIONS + 1) * 2 * 2);
  const index: number[] = [];
  let along = 0;
  let lastX = 0;
  let lastZ = 0;
  for (let i = 0; i <= SECTIONS; i++) {
    const heading = track(i / SECTIONS, HALF, FAR, NEAR, CORNER, P);
    if (i > 0) along += Math.hypot(P.x - lastX, P.z - lastZ);
    lastX = P.x;
    lastZ = P.z;
    // Across the line of flow.
    const px = Math.cos(heading);
    const pz = -Math.sin(heading);
    const o = i * 6;
    positions[o] = P.x + px * w;
    positions[o + 1] = 0;
    positions[o + 2] = P.z + pz * w;
    positions[o + 3] = P.x - px * w;
    positions[o + 4] = 0;
    positions[o + 5] = P.z - pz * w;
    const u = along / REPEAT;
    uvs[i * 4] = u;
    uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = u;
    uvs[i * 4 + 3] = 1;
    if (i < SECTIONS) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

export function LavaRiver() {
  const texture = useMemo(() => cachedTexture('volcano:lava-river', lavaTexture), []);
  const river = useMemo(() => ribbon(WIDTH), []);
  const bank = useMemo(() => ribbon(WIDTH + 0.09), []);
  const glow = useMemo(() => ribbon(WIDTH + 0.4), []);
  useEffect(
    () => () => {
      river.dispose();
      bank.dispose();
      glow.dispose();
    },
    [river, bank, glow],
  );
  const tick = useMemo(
    () => (t: number) => {
      texture.offset.x = -t * FLOW;
    },
    [texture],
  );
  useSceneryTick(tick);
  return (
    <group>
      {/* A warm glow on the ground either side of the river. */}
      <mesh geometry={glow} position={[0, 0.004, 0]}>
        <meshBasicMaterial color="#ff6a1a" transparent opacity={0.18} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Dark stone banks. */}
      <mesh geometry={bank} position={[0, 0.008, 0]}>
        <meshStandardMaterial color="#2a1a1c" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* The lava itself, flowing. */}
      <mesh geometry={river} position={[0, 0.012, 0]}>
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
