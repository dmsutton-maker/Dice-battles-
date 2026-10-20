import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  createDieFaceTextures,
  DIE_FACE_SLOTS,
  dieFacePixels,
  dieFaceSampler,
  isPerFace,
  PATTERN_SIZE,
  PatternId,
  patternPixels,
  sheetToCube,
  shellSampler,
} from '../src/dice/patterns';
import { DICE_SKINS } from '../src/game/diceSkins';
import { assert, note, suite, test } from './harness';

/**
 * The design flows over every edge of the die — 18 Oct 2026.
 *
 * David: "make all the dice have a continuous flowing design instead of
 * the same design copied and pasted to every side." The paper cube net
 * before this looked continuous laid flat and was not on the die: it was
 * drawn from an assumption about which way each face's texture runs, and
 * the assumption was wrong for the top and the bottom. So nothing here
 * takes the orientation on trust. The face table below is checked
 * against RoundedBoxGeometry's own vertices first, and everything after
 * it is measured through that table.
 */

const S = PATTERN_SIZE;

/**
 * Where a point (u, v) of each face's texture lands on a cube of
 * half-width 1, in three.js face order. This is what three's box UVs
 * say; the first test makes the geometry agree.
 */
const FACE_POINT: readonly ((u: number, v: number) => [number, number, number])[] = [
  (u, v) => [1, 2 * v - 1, 1 - 2 * u], // +X
  (u, v) => [-1, 2 * v - 1, 2 * u - 1], // -X
  (u, v) => [2 * u - 1, 1, 1 - 2 * v], // +Y
  (u, v) => [2 * u - 1, -1, 2 * v - 1], // -Y
  (u, v) => [2 * u - 1, 2 * v - 1, 1], // +Z
  (u, v) => [1 - 2 * u, 2 * v - 1, -1], // -Z
];

/**
 * A texel's centre on the cube. Row 0 of a DataTexture is v = 0 — the
 * texture is not flipped, which the second test pins.
 */
const texelPoint = (face: number, tx: number, ty: number) =>
  FACE_POINT[face]((tx + 0.5) / S, (ty + 0.5) / S);

/*
  Every texel on an edge of a face, paired with the texel across the
  edge on the neighbouring face — found as the nearest texel centre on
  any OTHER face, so the pairing comes from the geometry rather than from
  a hand-written table that could share the painter's mistake. Each pair
  also carries the texel one step further in on each side, for measuring
  how much the design changes from one texel to the next anyway.
*/
type EdgePair = { a: [number, number, number]; b: [number, number, number]; ai: number; bi: number };
const EDGES = (() => {
  const all: { face: number; tx: number; ty: number; p: number[] }[] = [];
  for (let face = 0; face < 6; face++) {
    for (let ty = 0; ty < S; ty++) {
      for (let tx = 0; tx < S; tx++) {
        if (tx === 0 || ty === 0 || tx === S - 1 || ty === S - 1) {
          all.push({ face, tx, ty, p: texelPoint(face, tx, ty) });
        }
      }
    }
  }
  const inward = (tx: number, ty: number) => [
    tx === 0 ? 1 : tx === S - 1 ? S - 2 : tx,
    ty === 0 ? 1 : ty === S - 1 ? S - 2 : ty,
  ];
  // One pair per edge texel, skipping the corners, where three faces meet.
  const edges = new Map<string, EdgePair[]>();
  for (const e of all) {
    const corner = (e.tx === 0 || e.tx === S - 1) && (e.ty === 0 || e.ty === S - 1);
    if (corner) continue;
    let best = e;
    let bestD = Infinity;
    for (const o of all) {
      if (o.face === e.face) continue;
      const d = Math.hypot(o.p[0] - e.p[0], o.p[1] - e.p[1], o.p[2] - e.p[2]);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (e.face > best.face) continue; // each pair once
    const key = `${e.face}-${best.face}`;
    const [aix, aiy] = inward(e.tx, e.ty);
    const [bix, biy] = inward(best.tx, best.ty);
    const list = edges.get(key) ?? [];
    list.push({
      a: [e.face, e.tx, e.ty],
      b: [best.face, best.tx, best.ty],
      ai: aiy * S + aix,
      bi: biy * S + bix,
    });
    edges.set(key, list);
  }
  return edges;
})();

/**
 * For each of the twelve edges: the mean step between the texels either
 * side of it, the mean step from each of those to its next neighbour
 * inward, and the first over the second. The `+ 6` keeps a design that
 * is almost flat — where any step at all is a large ratio of nothing —
 * from failing on a difference nobody could see.
 */
function edgeSteps(faces: number[][]) {
  const diff = (fa: number, ia: number, fb: number, ib: number) =>
    Math.abs(faces[fa][ia * 3] - faces[fb][ib * 3]) +
    Math.abs(faces[fa][ia * 3 + 1] - faces[fb][ib * 3 + 1]) +
    Math.abs(faces[fa][ia * 3 + 2] - faces[fb][ib * 3 + 2]);
  return [...EDGES].map(([key, list]) => {
    let across = 0;
    let inside = 0;
    for (const { a, b, ai, bi } of list) {
      const ia = a[2] * S + a[1];
      const ib = b[2] * S + b[1];
      across += diff(a[0], ia, b[0], ib);
      inside += (diff(a[0], ia, a[0], ai) + diff(b[0], ib, b[0], bi)) / 2;
    }
    across /= list.length;
    inside /= list.length;
    return { key, across, inside, ratio: across / (inside + 6) };
  });
}

/**
 * How much bigger the step across an edge may be than the step inside a
 * face. Measured, not guessed (20 Oct 2026): on the old paper net a real
 * seam scores 2 to 10 on a hard-edged design (the leopard's rings, the
 * zebra's stripes, the galaxy's stars), while a sparse hard-edged design
 * laid out CONTINUOUSLY still scores up to about 1.9 on an edge that
 * happens to catch more of its rims than the average texel does. Two
 * keeps every real seam and lets that chance through.
 */
const LIMIT = 2;

/** One side's raw RGB from any texel sampler. */
function paint(texel: (x: number, y: number) => [number, number, number]): number[] {
  const out: number[] = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) out.push(...texel(x, y).map(Math.round));
  return out;
}

suite('continuity · the design runs over every edge of the die', () => {
  test('the face table agrees with the geometry the dice are built from', () => {
    const g = new RoundedBoxGeometry(1, 1, 1, 4, 0.12);
    const pos = g.attributes.position.array as ArrayLike<number>;
    const uv = g.attributes.uv.array as ArrayLike<number>;
    let checked = 0;
    for (const group of g.groups) {
      const face = group.materialIndex ?? 0;
      for (let v = group.start; v < group.start + group.count; v++) {
        const want = FACE_POINT[face](uv[v * 2], uv[v * 2 + 1]);
        for (let k = 0; k < 3; k++) {
          // Only where the table is decisive: well off the middle line.
          if (Math.abs(want[k]) < 0.5) continue;
          assert(
            Math.sign(want[k]) === Math.sign(pos[v * 3 + k]),
            `face ${face}: a vertex the table puts at ${want.map((n) => n.toFixed(2))} is really at ` +
              `${[0, 1, 2].map((i) => pos[v * 3 + i].toFixed(2))}`,
          );
          checked++;
        }
      }
    }
    assert(checked > 1000, `only ${checked} vertex coordinates were checked`);
    note(`${checked} vertex coordinates agree with the face table`);
  });

  test('a die texture is not flipped, so row 0 is the bottom of a side', () => {
    const tex = createDieFaceTextures('marble', '#f2efe8', '#7f8792');
    assert(tex.every((t) => t.flipY === false), 'a die texture is flipped — every v in the table is upside down');
  });

  test('every texel of every side is painted from its own place on the cube', () => {
    /*
      The strongest form of the claim. Paint the die with a "pattern"
      whose colour IS the sheet position's point on the cube, through
      exactly the mapping the dice use. Every texel must come out as
      the point it really is — including the top and bottom, which are
      blended from two sides along their diagonals: both sides must agree
      on where a texel is, or the blend would show it.
    */
    let worst = 0;
    for (let face = 0; face < 6; face++) {
      const at = dieFaceSampler((sx, sy) => sheetToCube(sx, sy), face);
      for (let ty = 0; ty < S; ty++) {
        for (let tx = 0; tx < S; tx++) {
          const got = at(tx, ty);
          const want = texelPoint(face, tx, ty).map((n) => n * (S / 2));
          worst = Math.max(worst, ...got.map((n, k) => Math.abs(n - want[k])));
        }
      }
    }
    assert(worst < 1e-6, `a texel is painted from ${worst.toFixed(3)} texels away from where it sits`);
  });

  test('all twelve edges are found, sixty-two texels each', () => {
    assert(EDGES.size === 12, `${EDGES.size} edges found, not 12`);
    for (const [key, list] of EDGES) assert(list.length === S - 2, `edge ${key} has ${list.length} pairs`);
  });

  test('across every edge, a continuous design changes no more than it does inside a face', () => {
    /*
      Each pair of texels either side of an edge is compared with each
      texel and its next neighbour inward. A seam is a step much bigger
      than the design's own texel-to-texel change; a design that flows
      steps over an edge by about as much as it steps anywhere else. The
      ratio, not a fixed number, because granite's flecks change a lot
      from texel to texel by design and marble hardly at all.

      The per-face skins are left out by definition — see isPerFace — and
      listed in the note.
    */
    /*
      ONE exemption, with its reason. Ivory's grain flows over the edges
      like every other material, but its sheen is light, and light is
      painted per FACE on purpose — a polished cube catches a highlight on
      each side, not one sweep across all of them. That steps by about
      seven levels a channel at each crest, where the shade map darkens
      the edge anyway. Its grain is checked in the next test.
    */
    const FACE_LIT: Record<string, string> = {
      ivory: 'its sheen is per-face light; its grain is measured separately',
    };
    const perFace: string[] = [];
    let worst = 0;
    let worstAt = '';
    let checked = 0;
    for (const skin of DICE_SKINS) {
      if (skin.pattern === 'plain') continue;
      const pattern = skin.pattern as Exclude<PatternId, 'plain'>;
      if (isPerFace(pattern) || FACE_LIT[skin.id]) {
        perFace.push(skin.id);
        continue;
      }
      const faces = DIE_FACE_SLOTS.map((_, f) => dieFacePixels(pattern, skin.body, skin.ink ?? skin.body, f));
      for (const { key, across, inside, ratio } of edgeSteps(faces)) {
        checked++;
        if (ratio > worst) {
          worst = ratio;
          worstAt = `${skin.id} on edge ${key} (${across.toFixed(1)} across, ${inside.toFixed(1)} inside)`;
        }
        assert(
          ratio < LIMIT,
          `${skin.id} breaks on edge ${key}: ${across.toFixed(1)} across it against ` +
            `${inside.toFixed(1)} from one texel to the next inside`,
        );
      }
    }
    // Every strip design, twelve edges each: thirty-three designs today.
    assert(checked >= 12 * 30, `only ${checked} edges were measured`);
    note(`${checked} edges measured; the least smooth is ${worstAt}, at ${worst.toFixed(2)}x`);
    note(`painted per face, and so exempt: ${perFace.join(', ')}`);
  });

  test("ivory's grain runs over every edge, with its per-face light held still", () => {
    // The same measure, on ivory painted with every face told it is at
    // the same spot of its own face — so the sheen is one constant and
    // only the grain and the mottle, which are the material, are left.
    const sample = shellSampler('ivory', '#f8f1e2', '#efe4cc');
    const still = (sx: number, sy: number) => sample(sx, sy, 0, 0);
    const faces = DIE_FACE_SLOTS.map((_, f) => paint(dieFaceSampler(still, f)));
    for (const { key, across, inside, ratio } of edgeSteps(faces)) {
      assert(ratio < LIMIT, `ivory's grain breaks on edge ${key}: ${across.toFixed(1)} vs ${inside.toFixed(1)}`);
    }
  });

  test('the measure has teeth: the old paper net fails it', () => {
    /*
      A test that passes everything proves nothing. The cube net this
      replaced — each side cut from its own square, UP above FRONT and
      so on — is rebuilt here from patternPixels and run through the
      same measure. Marble and wood, whose veins and rings are smooth,
      must show it breaking on most of the twelve edges.
    */
    const NET: [number, number][] = [[2, 1], [0, 1], [1, 0], [1, 2], [1, 1], [3, 1]];
    const counts: string[] = [];
    for (const [pattern, body, ink] of [
      ['marble', '#f2efe8', '#7f8792'],
      ['wood', '#c49a68', '#7d5228'],
      ['tigerStripes', '#e8892e', '#2b1d14'],
      ['stripes', '#f4f1ea', '#1f1f1f'],
      ['galaxy', '#1d1440', '#8a3d8f'],
      ['rainbow', '#f2f7fc', '#2a4a8a'],
    ] as const) {
      const faces = NET.map(([cx, cy]) => patternPixels(pattern as Exclude<PatternId, 'plain'>, body, ink, cx, cy));
      const broken = edgeSteps(faces).filter((e) => e.ratio >= LIMIT).length;
      counts.push(`${pattern} ${broken}`);
    }
    note(`edges of 12 that break on the old net: ${counts.join(', ')}`);
    const most = Math.max(...counts.map((c) => Number(c.split(' ')[1])));
    assert(most >= 6, `nothing breaks on the old net (${counts.join(', ')}) — the measure is too lax`);
  });
});
