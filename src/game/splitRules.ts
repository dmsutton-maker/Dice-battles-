import { PrisonerColorId } from './colors';
import { ModeId, PrisonerUnit } from './modes';

/**
 * What a colour match DOES in two-player split screen, for every mode.
 *
 * Split screen used to play Color Rush rules only. The other three each
 * need something the two-board layout does not give for free:
 *
 * - Ultimate matches against your own retreat as well as your jail.
 * - Color War cares which colour is YOURS, not just which came up.
 * - Skirmish is defined by ONE shared jail, which is the awkward one:
 *   each player has their own board here. It works by keeping the two
 *   jails in step — claiming a colour takes it out of the other player's
 *   jail too, and it shows up on their wall as gone. So both boards are
 *   views of the same six prisoners rather than two separate sets.
 *
 * Kept pure and out of the component so all four can be tested without a
 * renderer — the rules are the part worth being sure about.
 */

export type Zone = 0 | 1;

export interface SplitBoards {
  a: PrisonerUnit[];
  b: PrisonerUnit[];
}

export type MatchEffect =
  /** A prisoner reached the retreat. */
  | 'rescued'
  /** Ultimate: a rescued prisoner went back to jail. */
  | 'returned'
  /** Skirmish: taken out from under the other player. */
  | 'stolen'
  /** Nothing to do — already free, already taken, not your colour. */
  | 'none';

export interface SplitOutcome {
  boards: SplitBoards;
  winner: Zone | null;
  effect: MatchEffect;
}

/** How many rescues take the match, per mode. */
export function targetFor(mode: ModeId): number {
  return mode === 'colorwar' ? 3 : 6;
}

const countAt = (units: PrisonerUnit[], kind: 'jail' | 'retreat'): number =>
  units.filter((u) => u.station.kind === kind).length;

function moveUnit(
  units: PrisonerUnit[],
  key: string,
  kind: 'jail' | 'retreat' | 'wall',
  index: number,
): PrisonerUnit[] {
  return units.map((u) => (u.key === key ? { ...u, station: { kind, index } } : u));
}

/**
 * Apply one matched pair for `zone`.
 *
 * `zoneColors` is only read in Color War, where it says which colour each
 * player is fighting for.
 */
export function applySplitMatch(
  mode: ModeId,
  boards: SplitBoards,
  zone: Zone,
  colorId: PrisonerColorId,
  zoneColors?: [PrisonerColorId, PrisonerColorId],
): SplitOutcome {
  const mine = zone === 0 ? boards.a : boards.b;
  const theirs = zone === 0 ? boards.b : boards.a;
  const rebuild = (m: PrisonerUnit[], t: PrisonerUnit[]): SplitBoards =>
    zone === 0 ? { a: m, b: t } : { a: t, b: m };
  const nothing: SplitOutcome = { boards, winner: null, effect: 'none' };

  // Color War: only your own colour counts for anything.
  if (mode === 'colorwar') {
    if (!zoneColors || colorId !== zoneColors[zone]) return nothing;
  }

  if (mode === 'ultimate') {
    // Matching a colour you already freed sends it back — the whole point
    // of the mode, and it has to work here too.
    const freed = mine.find(
      (u) => u.colorId === colorId && u.station.kind === 'retreat',
    );
    if (freed) {
      const next = moveUnit(mine, freed.key, 'jail', freed.jailIndex);
      return { boards: rebuild(next, theirs), winner: null, effect: 'returned' };
    }
  }

  const inJail = mine.find(
    (u) => u.colorId === colorId && u.station.kind === 'jail',
  );
  if (!inJail) return nothing;

  if (mode === 'skirmish') {
    // Shared pool: only claimable if the other player has not taken it.
    const alsoTheirs = theirs.find(
      (u) => u.colorId === colorId && u.station.kind === 'jail',
    );
    if (!alsoTheirs) return nothing;

    const nextMine = moveUnit(mine, inJail.key, 'retreat', countAt(mine, 'retreat'));
    // On their board it moves to the wall: gone, and visibly taken.
    const nextTheirs = moveUnit(
      theirs,
      alsoTheirs.key,
      'wall',
      theirs.filter((u) => u.station.kind === 'wall').length,
    );
    const boardsNext = rebuild(nextMine, nextTheirs);

    // Nobody wins on a count — the round ends when the shared jail is
    // empty, and whoever holds more takes it.
    const emptied = countAt(nextMine, 'jail') === 0;
    if (!emptied) {
      return { boards: boardsNext, winner: null, effect: 'stolen' };
    }
    const mineScore = countAt(nextMine, 'retreat');
    const theirScore = countAt(nextTheirs, 'retreat');
    const winner: Zone | null =
      mineScore > theirScore ? zone : mineScore < theirScore ? other(zone) : null;
    return { boards: boardsNext, winner, effect: 'stolen' };
  }

  const rescued = countAt(mine, 'retreat');
  const next = moveUnit(mine, inJail.key, 'retreat', rescued);
  const winner: Zone | null = rescued + 1 >= targetFor(mode) ? zone : null;
  return { boards: rebuild(next, theirs), winner, effect: 'rescued' };
}

export function other(zone: Zone): Zone {
  return zone === 0 ? 1 : 0;
}

/** Rescues on a board, for the score strip. */
export function scoreOf(units: PrisonerUnit[]): number {
  return countAt(units, 'retreat');
}
