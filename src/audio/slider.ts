import { clampVolume } from './settings';

/**
 * The maths behind a volume slider, kept out of the component so it can be
 * tested headlessly — a slider whose left end is not silence, or whose
 * right end cannot reach full, is a bug you only find by dragging.
 */

/** Where a touch at `x` along a track of `trackWidth` points sits, 0..1. */
export function volumeFromTouch(x: number, trackWidth: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(trackWidth) || trackWidth <= 0) {
    return 0;
  }
  return clampVolume(x / trackWidth);
}

/** Fill width as a percentage string, for the filled part of the track. */
export function fillPercent(volume: number): `${number}%` {
  return `${Math.round(clampVolume(volume) * 100)}%`;
}

/** What the number next to the slider reads. Zero says so in words. */
export function volumeLabel(volume: number): string {
  const v = clampVolume(volume);
  return v === 0 ? 'OFF' : `${Math.round(v * 100)}%`;
}

/**
 * How many waves the speaker beside the slider should have — readable
 * before a five year old can read the percentage.
 *
 * It used to return an emoji (🔇 🔈 🔉 🔊). David asked on 10 Sep 2026
 * for these to be drawn like every other icon in the game, and there was
 * a second reason to want it: those four are four glyphs from the
 * phone's emoji font, not one set, and the muted one is a different
 * WIDTH from the loud one — so the label beside the slider shifted
 * sideways as you dragged it. A number here, a drawn icon in Icon.tsx,
 * and the shape stays put.
 */
export function volumeLevel(volume: number): 0 | 1 | 2 | 3 {
  const v = clampVolume(volume);
  if (v === 0) return 0;
  if (v <= 0.33) return 1;
  if (v <= 0.66) return 2;
  return 3;
}

/**
 * Where the knob's LEFT edge goes, in points, so the whole knob stays on
 * the track.
 *
 * Positioning it by percentage with a negative margin — what this used to
 * do — hangs it half off the left end at 0% and half off the right end at
 * 100%, which is the slider "going off the menu a little bit". Here the
 * travel is the track minus one knob width, so at either extreme the knob
 * is flush with the end instead of over it.
 */
export function knobLeft(
  volume: number,
  trackWidth: number,
  knobSize: number,
): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  const travel = Math.max(0, trackWidth - knobSize);
  return clampVolume(volume) * travel;
}
