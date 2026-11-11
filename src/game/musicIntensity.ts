/**
 * When the battle music should build up.
 *
 * Marc, 5 Nov 2026: "what about it changing like as there's only like one
 * more player to save then it gets a little bit more intense". So the music
 * goes hot the moment EITHER side is one rescue from winning — the player's
 * own count or the rival's, whichever gets there first — and stays hot for
 * the rest of that battle (src/audio/sounds.ts, setMusicIntensity).
 *
 * Pure on purpose: the screens know the counts, this knows the rule.
 *
 * `total` is the number of rescues that wins — six in Classic and Ultimate,
 * three in Color War. Skirmish has no count to win on: it ends when the
 * shared jail empties, so the screen passes everything taken so far as
 * `freedMine` and 0 as `freedTheirs`, and "one from winning" means one
 * prisoner left in jail.
 */
export function oneFromWinning(
  freedMine: number,
  freedTheirs: number,
  total: number,
): boolean {
  if (!Number.isFinite(total) || total < 2) return false;
  const last = total - 1;
  return freedMine >= last || freedTheirs >= last;
}
