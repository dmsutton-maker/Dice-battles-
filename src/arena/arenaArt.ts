import type { ImageSourcePropType } from 'react-native';
import type { ArenaId } from './arenas';

/**
 * A drawn picture of each battlefield, for the Inventory.
 *
 * These were emoji — 🏰 🌅 🌴 🚀 — the last four left in the interface
 * after the Paper & Ink pass took them out of everywhere else. David
 * asked on 26 Aug 2026 for hand-drawn pictures with colour and enough
 * detail to be "distinct and accurate", and the emoji failed both halves:
 * 🏰 and 🌅 are the SAME building in the game, so the two castles were
 * telling a player nothing about which was which, and every one of them
 * renders differently on every phone.
 *
 * ACCURATE. Every colour in these is lifted out of the arena it draws
 * (see src/arena/*.tsx and assets/arenas/make-arenas.py), so the picture
 * in the menu is made from the same paint as the place it opens. The
 * castle's coral roofs are #ff7f66 because that is what the roofs are.
 *
 * DISTINCT. The hard half, and one this project has already been caught
 * by: the Sunset Castle was reported as "doesn't really look any
 * different from the regular castle" and had to be rebuilt once already.
 * The two share a building, so the difference is carried by what actually
 * differs when you stand in them — a low huge sun instead of a high small
 * one, warm masonry instead of grey, lit windows, and long shadows thrown
 * toward the viewer.
 *
 * ── WHY THIS FILE EXISTS SEPARATELY FROM arenas.tsx ──
 *
 * It would read better on the ArenaDef beside `emoji` and `skyColor`. It
 * cannot go there: `arenas.tsx` is imported directly by the headless test
 * suite, which is plain node with no bundler, and `require()` of a PNG
 * throws there. Keeping the images in their own module means the arena
 * definitions stay importable and the tests keep exercising real code
 * rather than a copy of it.
 */
export const ARENA_ART: Record<ArenaId, ImageSourcePropType> = {
  castle: require('../../assets/arenas/castle.png'),
  castleSunset: require('../../assets/arenas/castle-sunset.png'),
  jungle: require('../../assets/arenas/jungle.png'),
  space: require('../../assets/arenas/space.png'),
};
