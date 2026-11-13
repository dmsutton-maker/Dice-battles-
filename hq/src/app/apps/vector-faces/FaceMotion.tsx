'use client';

import Image from 'next/image';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { colors, fonts } from '@/components/site/tokens';
import styles from '../../site.module.css';

/*
  The moving faces on /apps/vector-faces, and the one switch that stops
  them (WCAG 2.2.2: anything that moves on its own for more than five
  seconds needs a way to pause it).

  Without JavaScript nothing here changes the page: every face is a
  <picture> whose loop plays unless the device asks for reduced motion,
  exactly as the server drew it, and there is no button. Once the page
  is running, the button appears in a space already kept for it (so
  nothing below it moves), and pausing takes each loop's <source> out of
  its <picture>. The <img> itself stays put, so the browser swaps in the
  still in the same box, keeps showing the loop until the still has
  arrived, and uses a still it already has rather than asking again.

  The choice is remembered on this browser (localStorage). Where storage
  is blocked the switch still works for the visit.
*/

const STORAGE_KEY = 'vectorFaces.motion';

type FaceMotion = { paused: boolean; ready: boolean; setPaused: (paused: boolean) => void };

const FaceMotionContext = createContext<FaceMotion>({ paused: false, ready: false, setPaused: () => {} });

export function FaceMotionProvider({ children }: { children: ReactNode }) {
  // Playing on the server and on first render, so the page hydrates as drawn.
  const [paused, setPausedState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === 'paused') setPausedState(true);
    } catch {
      // Storage blocked (private mode, a strict setting): start playing.
    }
    setReady(true);
  }, []);

  const setPaused = useCallback((next: boolean) => {
    setPausedState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, 'paused');
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Not remembered, but the switch still works for this visit.
    }
  }, []);

  const value = useMemo(() => ({ paused, ready, setPaused }), [paused, ready, setPaused]);
  return <FaceMotionContext.Provider value={value}>{children}</FaceMotionContext.Provider>;
}

/**
 * A face as the watch draws it: moving where there is a loop of it, still
 * otherwise. The loop is a <source> that only applies to
 * `prefers-reduced-motion: no-preference`, so anybody who has asked their
 * phone or computer for less motion (or whose browser cannot say) gets the
 * still in the same place, and so does everybody once the page is paused.
 * A browser fetches only the one it shows, and only as it scrolls into view.
 */
export function FacePicture({ still, loop, alt, style }: { still: string; loop?: string; alt: string; style: CSSProperties }) {
  const { paused } = useContext(FaceMotionContext);
  // The box is the watch screen's shape whichever file fills it. The loop's
  // 316x385 is a hair taller for its width than the still's 422x514, and left
  // to itself the page below would creep by about half a pixel at each press.
  const img = (
    <Image src={still} alt={alt} width={211} height={257} unoptimized loading="lazy" style={{ aspectRatio: '211 / 257', ...style }} />
  );
  if (!loop) return img;
  return (
    <picture style={{ display: 'block' }}>
      {!paused && <source srcSet={loop} type="image/webp" media="(prefers-reduced-motion: no-preference)" />}
      {img}
    </picture>
  );
}

/**
 * "Pause motion" / "Play motion". Every one on the page works the same
 * switch. The space is kept (44px, a finger's height) from the first
 * paint, and hidden altogether for anybody whose device asks for reduced
 * motion, who sees stills whatever the switch says (.psg-motion-slot in
 * site.module.css).
 *
 * The words change with the state, as on a video player, so the button
 * has no aria-pressed: "Play motion, pressed" would contradict itself
 * (WAI-ARIA Authoring Practices: a toggle's label must not change).
 */
export function FaceMotionToggle({ style }: { style?: CSSProperties }) {
  const { paused, ready, setPaused } = useContext(FaceMotionContext);
  return (
    <div className="psg-motion-slot" style={{ display: 'flex', alignItems: 'center', minHeight: 44, ...style }}>
      {ready && (
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          className={styles.pillButton}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            padding: '0 18px',
            borderRadius: 999,
            border: `1px solid ${colors.fieldBorder}`,
            background: colors.offWhite,
            color: colors.ink,
            font: `700 13px ${fonts.body}`,
            cursor: 'pointer',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
            {paused ? (
              <path d="M2.5 1.2v9.6L10.5 6z" fill="currentColor" />
            ) : (
              <path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" />
            )}
          </svg>
          {paused ? 'Play motion' : 'Pause motion'}
        </button>
      )}
    </div>
  );
}
