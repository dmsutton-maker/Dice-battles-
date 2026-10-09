/**
 * What the board tells an arena about the round being played on it.
 *
 * Arenas are otherwise pure scenery: they take no game state, which is
 * what keeps a new battlefield to one visual component and one registry
 * line. This is the single exception, and it earns it.
 *
 * David, 20 Sep 2026: "make the platforms in color war match the colors
 * of whatever the colors being used are", "and make the corresponding
 * colors also for skirmish". The retreat pads have to be painted with
 * the colours actually in play, and in Color War those are drawn fresh
 * each round — so they cannot live in the arena's own palette.
 */
export interface ArenaProps {
  /**
   * The colour of each retreat pad, left to right, one per lane — built
   * by `laneColors` in src/game/modes.ts from the prisoners on the
   * board, so a pad is always the colour of the figure that lands on it.
   *
   * Undefined, or a null entry, means "no round is being played here":
   * the arena falls back to its own scenery colours. Nothing renders an
   * arena outside a battle today, but an arena that needs the board to
   * exist before it can draw is a trap for the first preview screen that
   * tries.
   */
  padColors?: readonly (string | null)[];
}
