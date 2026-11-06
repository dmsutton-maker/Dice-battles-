import type { ThemedArenaId } from './themeData';

/**
 * What each battlefield's jail is — one kind per board, no two alike.
 *
 * The board redesign (docs/board-redesign.md, 18 Oct 2026) found the jail
 * was "essentially the same thin dark railing" on all twenty boards: nine
 * bars behind the far wall of a coral reef and a rooftop alike. The rule
 * for every board is that you can tell which one it is with the colour
 * turned off, and the jail is one of the four big pieces that has to
 * carry that.
 *
 * Keyed by ARENA ID, deliberately not by `ArenaTheme.structure`. The
 * structure says what the WALLS are built of, and walls get rebuilt —
 * two boards were being given new wall structures in the same week this
 * was written. A jail that followed the walls would change shape every
 * time somebody retiled a wall, and two boards that came to share a wall
 * kind would quietly start sharing a jail too.
 *
 * This file is free of React and three.js so the test suite can check
 * that every board has one and that none of them repeat.
 */
export type JailKind =
  | 'portcullis'    // castle: stone gatehouse, iron portcullis with spikes
  | 'stockade'      // sunset castle: pointed log palisade, plank gate, two torches
  | 'bambooCage'    // jungle: bamboo poles, vine knots, leaves
  | 'forceField'    // space: emitter frame, shimmering field, glowing bars
  | 'adobeHut'      // desert: mud wall, flat roof on vigas, timber-barred windows
  | 'logCabin'      // autumn: stacked logs, cut ends, shingled roof
  | 'icicleCage'    // frozen lights: ice beams hung with icicles
  | 'crystalCage'   // crystal cavern: glowing violet and teal shards
  | 'birdcage'      // sky kingdom: gold wire dome, ring on top
  | 'airlockPod'    // moon base: ribbed hull shell, round hatch, portholes
  | 'igloo'         // snowy hollow: cut-away snow-block dome
  | 'obsidianCage'  // volcano: black glassy bars, embers at their feet
  | 'chickenCoop'   // farm: red coop, white trim, chicken wire, ramp
  | 'treasureChest' // beach: wooden chest, gold bands, domed lid open
  | 'gingerbread'   // candy: gingerbread house, icing, gumdrops, candy canes
  | 'willowCage'    // glow glade: woven roots, glowing spores
  | 'brig'          // pirate cove: plank bulkhead, iron bars, swinging lantern
  | 'giantClam'     // coral reef: open clam, pearl
  | 'fireEscape'    // rooftop city: brick wall, lit windows, railing, grating
  | 'toyChest'      // toy room: painted chest, flat lid, blocks and a ball
  | 'boneCage'      // dino valley: bars of bone with knobbed ends, a horned skull
  | 'sunShrine'     // sun temple: sandstone pillars, a carved lintel with a gold sun, braziers
  | 'toriiGate'     // moon garden: a torii gate over a bamboo fence, paper lanterns swinging
  // New members go ABOVE this comment, one per line, so six seasons can
  // be built side by side and merge cleanly. The ; stays on its own line.
  ;

/** Every board in the registry: the sixteen themed ones and the four originals. */
export type JailArenaId = ThemedArenaId | 'castle' | 'castleSunset' | 'jungle' | 'space';

export const ARENA_JAILS: Record<JailArenaId, JailKind> = {
  castle: 'portcullis',
  castleSunset: 'stockade',
  jungle: 'bambooCage',
  space: 'forceField',
  desert: 'adobeHut',
  autumn: 'logCabin',
  aurora: 'icicleCage',
  cavern: 'crystalCage',
  sky: 'birdcage',
  moon: 'airlockPod',
  snow: 'igloo',
  volcano: 'obsidianCage',
  farm: 'chickenCoop',
  beach: 'treasureChest',
  candy: 'gingerbread',
  glade: 'willowCage',
  cove: 'brig',
  reef: 'giantClam',
  city: 'fireEscape',
  toybox: 'toyChest',
  dino: 'boneCage',
  // Season 2 of the pass, Sun & Moon (21 Oct 2026).
  suntemple: 'sunShrine',
  moongarden: 'toriiGate',
};
