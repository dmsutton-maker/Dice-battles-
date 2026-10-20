import * as THREE from 'three';

/**
 * The inside of every pit that is not plain water, in one shader.
 *
 * The tray floor is ONE plane with no hole in it (the hole exists only in
 * the physics), so a pit cannot be drawn by modelling a shaft and looking
 * into it. Each pit is instead a flat square lying exactly over the hole,
 * and this shader works out, for every pixel, what a ray from the camera
 * would hit if the hole were real: the far wall, a side wall, or the
 * bottom. It is the same trick as an "interior mapping" window in a city
 * game. It costs one draw call, it follows the camera's tilt, and it is
 * why the hatch looks like a hatch and the chasm like a drop rather than
 * a painted square.
 *
 * MODE picks what the walls and the bottom are made of. The liquids (lava,
 * mud, chocolate) use the same machinery with a very shallow shaft, so the
 * surface sits a hand's width below the floor with a lip round it, which
 * is what makes it read as a pool rather than a sticker.
 *
 * Time comes from the shared water clock (water.tsx / waterClock.tsx): a
 * pit material puts itself in LIVE like any pond does, and a scene with
 * no clock (the arena preview) simply holds still.
 */

export const PIT_MODES = {
  stars: 1,
  chasm: 2,
  skyGap: 3,
  crater: 4,
  lava: 5,
  quicksand: 6,
  mud: 7,
  chocolate: 8,
  whirlpool: 9,
  ice: 10,
  skylight: 11,
  cargo: 12,
  toyBox: 13,
  // Dino Valley's tar pit, 20 Oct 2026.
  tar: 14,
} as const;

export type PitMode = keyof typeof PIT_MODES;

const VERTEX = `
  varying vec3 vWorld;
  varying vec3 vCenter;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAGMENT = `
  uniform float uTime;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform float uDepth;
  uniform float uHalf;
  varying vec3 vWorld;
  varying vec3 vCenter;

  // Palette constants below are written as sRGB, like every hex colour
  // in the project, and brought into the working (linear) space here.
  vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
  // x: distance to the nearest cell edge (thin lines = cracks, plate
  // seams); y: a stable random number for the cell this point is in.
  vec2 cells(vec2 p, float t) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 id = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = hash2(i + g);
        o = 0.5 + 0.3 * sin(t + 6.2831 * o);
        vec2 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) { d2 = d; }
      }
    }
    return vec2(sqrt(d2) - sqrt(d1), hash(id));
  }

  // ---- Liquids: the surface at the bottom of a shallow lip ----------
  vec3 liquid(vec2 q, float t) {
    float r = length(q);
    float a = atan(q.y, q.x);
  #if MODE == 5
    // Lava: drifting crust plates with glowing seams, and the odd bubble.
    vec2 c = cells(q * 1.9 + vec2(t * 0.05, t * 0.03), t * 0.2);
    float n = fbm(q * 1.4 + vec2(t * 0.07, -t * 0.05));
    // Molten orange, white-yellow only right in the seams between plates.
    vec3 hot = mix(uA * 0.85, uA, n);
    hot = mix(hot, uC, smoothstep(0.07, 0.0, c.x));
    float crust = smoothstep(0.06, 0.2, c.x) * step(0.35, c.y);
    vec3 col = mix(hot, mix(srgb(vec3(0.16, 0.06, 0.05)), srgb(vec3(0.34, 0.12, 0.07)), n), crust * 0.92);
    vec2 bq = q * 2.2;
    vec2 bc = floor(bq);
    float ph = fract(t * 0.35 + hash(bc) * 7.0);
    float bd = length(fract(bq) - 0.5 - 0.2 * (hash2(bc) - 0.5));
    float bubble = smoothstep(0.03, 0.0, abs(bd - ph * 0.22)) * (1.0 - ph) * step(0.55, hash(bc + 3.1));
    return col + uC * bubble * 0.9;
  #elif MODE == 6
    // Quicksand: a slow swirl drawing down into a darker middle.
    float s = sin(a * 3.0 + r * 9.0 - t * 0.9 + fbm(q * 2.5) * 2.0);
    vec3 col = mix(uA * 0.62, uA * 1.12, smoothstep(-0.7, 0.7, s));
    col = mix(col, uB, (1.0 - smoothstep(0.0, 0.7, r)) * 0.7);
    col *= 0.9 + 0.2 * hash(floor(q * 60.0));
    return col;
  #elif MODE == 7
    // Mud: lumpy, wet, with highlights that slide about and slow bubbles.
    float n = fbm(q * 2.4 + vec2(t * 0.03, 0.0));
    vec3 col = mix(uB, uA, smoothstep(0.25, 0.75, n));
    // Wet highlights as soft blobs, not lines (lines read as cracks).
    float gloss = smoothstep(0.62, 0.8, noise(q * 2.2 + vec2(t * 0.06, t * 0.04)));
    col += srgb(vec3(0.85, 0.78, 0.66)) * gloss * 0.12;
    vec2 bq = q * 1.8;
    vec2 bc = floor(bq);
    float ph = fract(t * 0.25 + hash(bc) * 5.0);
    float bd = length(fract(bq) - 0.5);
    col += uA * 0.35 * smoothstep(0.03, 0.0, abs(bd - ph * 0.25)) * (1.0 - ph) * step(0.6, hash(bc + 1.7));
    return col;
  #elif MODE == 8
    // Chocolate: a glossy stirred swirl, with the cream highlight that
    // makes it look melted rather than painted.
    float s = sin(a * 2.0 + r * 6.5 - t * 0.7 + fbm(q * 1.5 + t * 0.05) * 1.6);
    vec3 col = mix(uB, uA, smoothstep(-0.6, 0.9, s));
    float sheen = smoothstep(0.82, 0.98, s) * (0.6 + 0.4 * noise(q * 3.0));
    col = mix(col, uC, sheen * 0.55);
    return col;
  #elif MODE == 9
    // Whirlpool: spiral arms of foam winding into a dark eye.
    float s = sin(a * 3.0 - log(r + 0.04) * 4.5 + t * 2.2 + noise(q * 4.0) * 0.8);
    vec3 col = mix(uB, uA, smoothstep(0.05, 0.95, r));
    float foam = smoothstep(0.55, 0.95, s) * smoothstep(0.05, 0.35, r);
    col = mix(col, uC, foam * 0.75);
    col *= 0.35 + 0.65 * smoothstep(0.0, 0.32, r);
    return col;
  #elif MODE == 14
    // Tar: thick, glossy and nearly black, the sky's sheen sliding across
    // it, and big slow bubbles that swell up as domes and pop.
    float n = fbm(q * 1.6 + vec2(t * 0.02, 0.0));
    vec3 col = mix(uB, uA, smoothstep(0.3, 0.8, n));
    float streak = smoothstep(0.35, 0.0, abs(q.x * 0.6 + q.y - 0.25 + 0.12 * sin(t * 0.3)));
    col += uC * streak * 0.3;
    vec2 bq = q * 1.4;
    vec2 bc = floor(bq);
    vec2 f = fract(bq) - 0.5 - 0.2 * (hash2(bc) - 0.5);
    float ph = fract(t * 0.18 + hash(bc) * 5.0);
    float rad = ph * 0.3;
    float live = step(0.45, hash(bc + 2.3)) * (1.0 - smoothstep(0.86, 1.0, ph));
    float dome = smoothstep(rad, rad - 0.03, length(f)) * live;
    col = mix(col, uA * 1.5, dome * 0.45);
    float glint = smoothstep(rad * 0.45, 0.0, length(f + vec2(rad * 0.35, -rad * 0.35))) * dome;
    col += uC * glint * 0.7;
    // The ring a popped bubble leaves.
    float popped = step(0.86, ph) * step(0.45, hash(bc + 2.3));
    col += uC * 0.25 * popped * smoothstep(0.03, 0.0, abs(length(f) - 0.3 - (ph - 0.86) * 0.6)) * (1.0 - ph) * 7.0;
    return col;
  #else
    // Ice: pale and cracked, with deeper blue where it is thick.
    vec2 c = cells(q * 1.7, 0.0);
    vec2 c2 = cells(q * 4.1 + 3.0, 0.0);
    float n = fbm(q * 1.2);
    vec3 col = mix(uB, uA, 0.55 + 0.45 * smoothstep(0.3, 0.7, n));
    col = mix(col, uC, smoothstep(0.035, 0.0, c.x) * 0.9);
    col = mix(col, uC, smoothstep(0.02, 0.0, c2.x) * 0.45);
    float shine = smoothstep(0.4, 0.0, abs(q.x + q.y * 0.8 - 0.3)) * 0.18;
    return col + uC * shine;
  #endif
  }

  // ---- Walls --------------------------------------------------------
  vec3 wallColor(float u, float y, float d, vec2 n) {
  #if MODE == 1
    // Hull plating, ribbed, with a lit strip just under the rim.
    vec3 metal = mix(srgb(vec3(0.17, 0.19, 0.25)), srgb(vec3(0.32, 0.35, 0.42)), noise(vec2(u * 3.0, y * 9.0)));
    metal *= 1.0 - 0.5 * step(0.9, fract(u * 2.5));
    vec3 col = metal * (1.0 - 0.7 * d);
    col += uC * smoothstep(0.03, 0.0, abs(y + 0.1)) * 1.1;
    return col;
  #elif MODE == 2
    // Rock, dark at the lip, lit violet from far below.
    // Rock that disappears into violet haze the deeper it goes, so
    // there is no visible floor: the glow simply thickens.
    float k = fbm(vec2(u * 3.0, y * 2.0));
    vec3 rock = uB * 0.75 * (0.55 + 0.9 * k);
    return mix(rock, uC * 0.22, smoothstep(0.05, 0.95, d));
  #elif MODE == 3
    // The cloud the gap is cut through: soft, bright, blue in the folds.
    float k = fbm(vec2(u * 2.5, y * 5.0));
    return mix(uB * 1.4, uA, 0.55 + 0.45 * k) * (1.0 - 0.25 * d);
  #elif MODE == 4
    // A sloping crater wall in low sun: one side lit, one in shadow.
    vec3 N = normalize(vec3(n.x, 0.8, n.y));
    float lam = max(dot(N, normalize(vec3(0.4, 0.75, 0.55))), 0.0);
    float n2 = fbm(vec2(u * 4.0, y * 6.0));
    return uA * (0.12 + 1.0 * lam * lam) * (0.8 + 0.35 * n2) * (1.0 - 0.35 * d);
  #elif MODE == 11
    // Plaster walls of the room below, lit warm from beneath.
    vec3 col = uA * (0.5 + 0.7 * d);
    col *= 1.0 - 0.25 * step(0.92, fract(u * 1.6));
    return col;
  #elif MODE == 12
    // Ship's planking, getting darker as it goes down.
    float plank = floor(y * 9.0);
    vec3 col = uA * (0.75 + 0.35 * hash(vec2(plank, n.x + n.y * 3.0)));
    col *= 1.0 - 0.6 * smoothstep(0.88, 1.0, fract(y * 9.0));
    col *= 0.85 + 0.15 * noise(vec2(u * 12.0, plank));
    return col * (1.0 - 0.65 * d);
  #elif MODE == 13
    // Painted toy-box boards.
    vec3 col = uA * (0.9 + 0.1 * noise(vec2(u * 8.0, y * 30.0)));
    col *= 1.0 - 0.3 * step(0.93, fract(u * 2.0));
    return col * (1.0 - 0.45 * d);
  #else
    // The lip round a liquid: the bank or the stone it sits in.
    return uB * (1.1 - 0.5 * d) * (0.8 + 0.4 * noise(vec2(u * 10.0, y * 40.0)));
  #endif
  }

  // ---- What is at the bottom ---------------------------------------
  vec3 bottomColor(vec2 q, vec3 rd, float dy, float t) {
  #if MODE == 1
    // Open space under the station: stars at a distance, so they slide
    // past the opening as the camera tilts.
    vec2 s = q + rd.xz / dy * 2.5;
    vec3 col = uB + srgb(vec3(0.16, 0.09, 0.3)) * smoothstep(0.45, 0.85, fbm(s * 0.9)) * 0.6;
    vec2 g = s * 8.0;
    vec2 cell = floor(g);
    float h = hash(cell);
    float star = smoothstep(0.12, 0.0, length(fract(g) - 0.5 - 0.3 * (hash2(cell) - 0.5)));
    float tw = 0.6 + 0.4 * sin(t * 2.0 + h * 40.0);
    col += vec3(1.0) * star * step(0.86, h) * tw;
    vec2 g2 = s * 3.0;
    vec2 c2 = floor(g2);
    col += srgb(vec3(0.75, 0.9, 1.0)) * smoothstep(0.1, 0.0, length(fract(g2) - 0.5)) * step(0.92, hash(c2 + 9.0)) * 1.4;
    return col;
  #elif MODE == 2
    // A bright core far below, fading out to the haze at the walls.
    return uC * (0.22 + 0.9 * exp(-dot(q, q) * 2.2) + 0.08 * noise(q * 3.0 + t * 0.2));
  #elif MODE == 3
    // Fields far below, seen through haze.
    vec2 f = (q + rd.xz / dy * 5.0) * 2.2;
    f += 0.35 * vec2(noise(f * 0.7), noise(f * 0.7 + 4.0));
    vec2 cell = floor(f * vec2(1.6, 2.1));
    float h = hash(cell);
    vec3 field = h < 0.3 ? srgb(vec3(0.49, 0.7, 0.34)) : h < 0.55 ? srgb(vec3(0.62, 0.76, 0.36))
               : h < 0.75 ? srgb(vec3(0.85, 0.78, 0.4)) : h < 0.9 ? srgb(vec3(0.36, 0.58, 0.3)) : srgb(vec3(0.68, 0.53, 0.33));
    vec2 e = fract(f * vec2(1.6, 2.1));
    float hedge = 1.0 - smoothstep(0.0, 0.06, min(min(e.x, 1.0 - e.x), min(e.y, 1.0 - e.y)));
    field = mix(field, srgb(vec3(0.24, 0.4, 0.2)), hedge * 0.8);
    float river = smoothstep(0.08, 0.02, abs(sin(f.x * 0.8) * 0.6 + f.y * 0.25 - 0.4));
    field = mix(field, srgb(vec3(0.45, 0.65, 0.85)), river);
    vec3 col = mix(field, uB, 0.3);
    float wisp = smoothstep(0.55, 0.8, fbm(q * 1.3 + vec2(t * 0.04, 0.0)));
    return mix(col, vec3(1.0), wisp * 0.6);
  #elif MODE == 4
    // The crater floor: regolith with small craters of its own.
    float n = fbm(q * 4.0);
    vec3 col = uA * (0.55 + 0.4 * n);
    vec2 c = q * 2.6;
    vec2 cc = floor(c);
    float cd = length(fract(c) - 0.5 - 0.3 * (hash2(cc) - 0.5)) * (0.8 + 0.5 * hash(cc + 2.0));
    float pit = step(0.8, hash(cc));
    col *= 1.0 - pit * 0.35 * smoothstep(0.22, 0.12, cd);
    col *= 1.0 + pit * 0.3 * smoothstep(0.05, 0.0, abs(cd - 0.22));
    return col;
  #elif MODE == 11
    // A lit room: warm floorboards and a round rug.
    float board = floor(q.x * 4.0);
    vec3 col = uB * (0.8 + 0.3 * hash(vec2(board, 1.0)));
    col *= 1.0 - 0.4 * smoothstep(0.9, 1.0, fract(q.x * 4.0));
    float rug = smoothstep(0.62, 0.58, length(q - vec2(0.1, -0.1)));
    col = mix(col, srgb(vec3(0.75, 0.33, 0.33)) * (0.85 + 0.15 * step(0.5, fract(length(q) * 8.0))), rug);
    return col * 1.25 + uC * 0.25;
  #elif MODE == 12
    // The sea under the hull, in the ship's shadow.
    vec2 s = q + rd.xz / dy * 1.4;
    vec2 c = cells(s * 2.0 + vec2(t * 0.15, t * 0.1), t);
    vec3 col = mix(uB, uC, 0.35 + 0.25 * sin(s.x * 2.0 + s.y * 1.3 + t * 0.8) + 0.2 * noise(s * 3.0));
    col = mix(col, vec3(0.8), smoothstep(0.05, 0.0, c.x) * 0.18);
    return col * 0.8;
  #elif MODE == 13
    // A jumble of toys: balls, blocks and stars in bright paint.
    vec2 g = q * 2.6;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5 - 0.25 * (hash2(cell) - 0.5);
    float h = hash(cell);
    vec3 paint = h < 0.25 ? srgb(vec3(0.9, 0.36, 0.33)) : h < 0.5 ? srgb(vec3(0.3, 0.56, 0.86))
               : h < 0.75 ? srgb(vec3(0.96, 0.78, 0.3)) : srgb(vec3(0.38, 0.74, 0.45));
    float shape = h < 0.4 ? length(f) - 0.33 : h < 0.75 ? max(abs(f.x), abs(f.y)) - 0.3 : abs(f.x) + abs(f.y) - 0.38;
    vec3 col = mix(uB, paint * (0.75 + 0.45 * (0.5 - f.y)), smoothstep(0.02, -0.02, shape));
    return col;
  #else
    return liquid(q, t);
  #endif
  }

  void main() {
    vec2 p = vWorld.xz - vCenter.xz;
    vec3 rd = normalize(vWorld - cameraPosition);
    float dy = max(-rd.y, 0.001);
    float t = uTime;

    // Where does the ray leave the shaft: through a wall, or the bottom?
    float tb = uDepth / dy;
    float tx = abs(rd.x) > 1e-4 ? ((rd.x > 0.0 ? uHalf : -uHalf) - p.x) / rd.x : 1e4;
    float tz = abs(rd.z) > 1e-4 ? ((rd.z > 0.0 ? uHalf : -uHalf) - p.y) / rd.z : 1e4;
    float tw = min(tx, tz);
    vec3 h = vec3(p.x, 0.0, p.y) + rd * min(tw, tb);
    float d = clamp(-h.y / uDepth, 0.0, 1.0);

    vec3 col;
    if (tw < tb) {
      vec2 n = tx < tz ? vec2(-sign(rd.x), 0.0) : vec2(0.0, -sign(rd.z));
      float u = tx < tz ? h.z : h.x;
      col = wallColor(u, h.y, d, n);
    } else {
      col = bottomColor(h.xz, rd, dy, t);
    #if MODE != 2
      // Soft shadow where the bottom meets the walls.
      float edge = uHalf - max(abs(h.x), abs(h.z));
      col *= 0.6 + 0.4 * smoothstep(0.0, 0.25, edge);
    #endif
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** How far below the floor each kind of pit's bottom (or lip) sits. */
const DEPTHS: Record<PitMode, number> = {
  stars: 0.42,
  chasm: 2.2,
  skyGap: 0.32,
  crater: 0.5,
  lava: 0.1,
  quicksand: 0.07,
  mud: 0.08,
  chocolate: 0.1,
  whirlpool: 0.12,
  ice: 0.05,
  skylight: 1.5,
  cargo: 0.5,
  toyBox: 0.75,
  tar: 0.08,
};

/**
 * A pit's material. `a`, `b` and `c` mean different things per mode but
 * always come from the board's own palette (its `look.pit` colours):
 * roughly surface, depths, and the bright edge or glow.
 */
export function createPitMaterial(
  mode: PitMode,
  colors: { a: string; b: string; c: string },
  half: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    defines: { MODE: PIT_MODES[mode] },
    uniforms: {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(colors.a) },
      uB: { value: new THREE.Color(colors.b) },
      uC: { value: new THREE.Color(colors.c) },
      uDepth: { value: DEPTHS[mode] },
      uHalf: { value: half },
    },
  });
}
