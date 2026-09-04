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
 * A speaker that fills up as the slider rises — readable before a five
 * year old can read the percentage.
 */
export function volumeIcon(volume: number): string {
  const v = clampVolume(volume);
  if (v === 0) return '🔇';
  if (v <= 0.33) return '🔈';
  if (v <= 0.66) return '🔉';
  return '🔊';
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
