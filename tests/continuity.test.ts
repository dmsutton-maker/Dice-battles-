import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  createDieFaceTextures,
  DIE_FACE_SLOTS,
  dieFacePixels,
  dieFaceSampler,
  PATTERN_SIZE,
  PatternId,
  patternPixels,
  sheetToCube,
} from '../src/dice/patterns';
import { DICE_SKINS } from '../src/game/diceSkins';
import { assert, note, suite, test } from './harness';

/**
 * The design flows over every edge of the die — 18 Oct 2026, and over
 * every edge of EVERY die since 21 Oct 2026.
 *
 * David: "make all the dice have a continuous flowing design instead of
 * the same design copied and pasted to every side." The paper cube net
 * before this looked continuous laid flat and was not on the die: it was
 * drawn from an assumption about which way each face's texture runs, and
 * the assumption was wrong for the top and the bottom. So nothing here
 * takes the orientation on trust. The face table below is checked
 * against RoundedBoxGeometry's own vertices first, and everything after
 * it is measured through that table.
 *
 * Then, 21 Oct 2026: "Make sure EVERY DICE has a continuous pattern that
 * flows on every side of it." Until then a third of the skins — the
 * pizza, the balls, the compass, Neon, the metals' highlight — were
 * exempt as one picture stamped per side. No skin is exempt now, and the
 * measure below runs on all of them.
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

/** Every patterned skin, with the ink its die is built with. */
const PATTERNED = DICE_SKINS.filter((s) => s.pattern !== 'plain').map((skin) => ({
  id: skin.id,
  pattern: skin.pattern as Exclude<PatternId, 'plain'>,
  body: skin.body,
  ink: skin.ink ?? skin.body,
}));

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

  test('across every edge, EVERY design changes no more than it does inside a face', () => {
    /*
      Each pair of texels either side of an edge is compared with each
      texel and its next neighbour inward. A seam is a step much bigger
      than the design's own texel-to-texel change; a design that flows
      steps over an edge by about as much as it steps anywhere else. The
      ratio, not a fixed number, because granite's flecks change a lot
      from texel to texel by design and marble hardly at all.

      NO EXEMPTIONS. The per-face skins, and ivory's per-face sheen,
      were left out of this until 21 Oct 2026. David: "Make sure EVERY
      DICE has a continuous pattern that flows on every side of it."
      Every patterned skin in the game is measured here, on all twelve
      edges, and a new skin cannot opt out.
    */
    let worst = 0;
    let worstAt = '';
    let checked = 0;
    const perSkin: string[] = [];
    for (const skin of PATTERNED) {
      const faces = DIE_FACE_SLOTS.map((_, f) => dieFacePixels(skin.pattern, skin.body, skin.ink, f));
      let skinWorst = 0;
      for (const { key, across, inside, ratio } of edgeSteps(faces)) {
        checked++;
        skinWorst = Math.max(skinWorst, ratio);
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
      perSkin.push(`${skin.id} ${skinWorst.toFixed(2)}`);
    }
    // Every patterned skin, twelve edges each: fifty-odd designs today.
    assert(checked === 12 * PATTERNED.length, `only ${checked} edges were measured`);
    assert(PATTERNED.length >= 50, `only ${PATTERNED.length} patterned skins were found`);
    note(`${checked} edges measured on ${PATTERNED.length} skins; the least smooth is ${worstAt}, at ${worst.toFixed(2)}x`);
    note(`worst edge per skin: ${perSkin.join(', ')}`);
  });

  test('the top and bottom carry the design over their diagonals too', () => {
    /*
      The twelve edges are not the only joins. The top and bottom are
      painted as four sides' continuations meeting along the cap's two
      diagonals (dieFaceSampler), and a design drawn from the strip
      rather than from the point in space can still kink there. So the
      same step measure is run along both diagonals of both caps,
      against the design's own steps beside them.

      The sticker covers the middle of each cap, so only the outer part
      of each diagonal — the part a player can see — is measured. The
      bar is looser than the edges' (3, not 2): a diagonal is a line of
      texels compared with their neighbours ACROSS it, which sits a
      half-texel off the join on each side, and on the strip designs
      (marble, wood, the cow) the mitre has always been a visible but
      quiet join that David accepted on 20 Oct 2026.
    */
    const DIAGONAL_LIMIT = 3;
    const RIM = Math.round(S * 0.33) + 2;
    let worst = 0;
    let worstAt = '';
    for (const skin of PATTERNED) {
      for (const face of [2, 3]) {
        const px = dieFacePixels(skin.pattern, skin.body, skin.ink, face);
        const at = (x: number, y: number) => [px[(y * S + x) * 3], px[(y * S + x) * 3 + 1], px[(y * S + x) * 3 + 2]];
        const diff = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        for (const flip of [false, true]) {
          let across = 0;
          let inside = 0;
          let n = 0;
          for (let i = 2; i < S - 3; i++) {
            const x = i;
            const y = flip ? S - 1 - i : i;
            if (Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) < RIM) continue;
            // The texels just either side of the diagonal, and their next neighbours.
            const a = at(x + 1, y);
            const b = at(x, flip ? y + 1 : y - 1);
            across += diff(a, b);
            inside += (diff(a, at(x + 2, y)) + diff(b, at(x, flip ? y + 2 : y - 2))) / 2;
            n++;
          }
          const ratio = across / n / (inside / n + 6);
          if (ratio > worst) {
            worst = ratio;
            worstAt = `${skin.id} on the ${face === 2 ? 'top' : 'bottom'}`;
          }
          assert(
            ratio < DIAGONAL_LIMIT,
            `${skin.id} kinks along a diagonal of the ${face === 2 ? 'top' : 'bottom'}: ` +
              `${(across / n).toFixed(1)} across it against ${(inside / n).toFixed(1)} beside it`,
          );
        }
      }
    }
    note(`the least smooth diagonal is ${worstAt}, at ${worst.toFixed(2)}x`);
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

  test('the measure has teeth for a picture stamped per side, too', () => {
    /*
      The exemption this test used to carry was for designs drawn once
      on every side. Rebuild that — the same front square on all six
      sides — for a few of the designs that used to be painted that way,
      and the measure must call it broken on most edges: a pepperoni
      cut off at the edge of a side is a seam however it got there.
    */
    const counts: string[] = [];
    for (const skin of PATTERNED.filter((s) => ['pizza', 'citrus', 'neon', 'supporterCompass', 'watermelon'].includes(s.pattern))) {
      const front = patternPixels(skin.pattern, skin.body, skin.ink);
      const faces = DIE_FACE_SLOTS.map(() => front);
      const broken = edgeSteps(faces).filter((e) => e.ratio >= LIMIT).length;
      counts.push(`${skin.id} ${broken}`);
    }
    note(`edges of 12 that break when one side is stamped six times: ${counts.join(', ')}`);
    const most = Math.max(...counts.map((c) => Number(c.split(' ')[1])));
    assert(most >= 6, `a stamped die passes the measure (${counts.join(', ')}) — it is too lax`);
  });
});
