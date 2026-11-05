/**
 * Which battle track plays next.
 *
 * Marc, 5 Nov 2026, on the three tracks the family chose: "the three that
 * we chose could rotate between the games". So they take turns, one per
 * battle, always in the same order — Pixel Rush, Brass Chase, Neon Sprint,
 * and round again — and the game remembers where it got to between
 * launches (src/audio/sounds.ts keeps it in storage under
 * `ROTATION_STORAGE_KEY`). Only a FRESH battle moves the rotation on;
 * resuming the same battle after a pause or an app switch does not.
 *
 * Pure on purpose, so the order can be tested without a phone.
 */
export const BATTLE_TRACKS = ['pixel', 'brass', 'neon'] as const;

export type BattleTrackId = (typeof BATTLE_TRACKS)[number];

/** Where the rotation is kept between launches. */
export const ROTATION_STORAGE_KEY = 'dice-battles:music-rotation';

export function isBattleTrack(value: unknown): value is BattleTrackId {
  return (BATTLE_TRACKS as readonly unknown[]).includes(value);
}

/**
 * The track after `previous`. Nothing played yet — a new install, or a
 * stored value that is missing or junk — starts the rotation at the top.
 */
export function nextBattleTrack(previous: BattleTrackId | null | undefined): BattleTrackId {
  if (!isBattleTrack(previous)) return BATTLE_TRACKS[0];
  const index = BATTLE_TRACKS.indexOf(previous);
  return BATTLE_TRACKS[(index + 1) % BATTLE_TRACKS.length];
}

/**
 * The last track that played, read back from storage. Anything that is
 * not one of the three — nothing stored, an old spelling, a corrupt
 * value — reads as "nothing yet", so the rotation starts at Pixel Rush.
 */
export function parseStoredTrack(raw: unknown): BattleTrackId | null {
  return isBattleTrack(raw) ? raw : null;
}
