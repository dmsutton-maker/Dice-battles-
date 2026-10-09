import { useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import { createFrameWatch } from './frameWatch';

/**
 * Reports back once the canvas has really DRAWN a given scene.
 *
 * It exists because of a bug David reported on 26 Aug 2026: "the arena
 * preview doesn't load fast enough when you click on an arena, you can
 * still see the previous arena you clicked on for a split second."
 *
 * The cause is not slowness, and that matters — no amount of making the
 * arena cheaper would have fixed it. The board runs with `frameloop`
 * set to `never` while a menu is open, because a phone should not render
 * a 3D scene nobody can see. A GL surface that has stopped rendering
 * still SHOWS ITS LAST FRAME. So opening a preview uncovered a canvas
 * holding a picture of whatever was drawn last — the arena previewed
 * before this one — and it stayed on screen until the loop restarted and
 * put something new there.
 *
 * Knowing when that has happened is the only thing this component does.
 * `useFrame` runs inside the render loop, so a tick here is proof of a
 * real frame rather than a guess at how long one ought to take.
 *
 * TWO frames, not one. The first tick of a restarted loop is the one that
 * builds the new arena's meshes and materials; the picture the player
 * sees is the one after it. Reporting on the first tick uncovers the
 * canvas a frame early and the flicker survives, smaller and harder to
 * describe.
 */
export function FirstFrame({
  token,
  onDrawn,
}: {
  /** Identifies the scene. Changing it starts the count again. */
  token: string;
  onDrawn: (token: string) => void;
}) {
  const watch = useRef(createFrameWatch()).current;
  useFrame(() => {
    const drawn = watch.tick(token);
    if (drawn !== null) onDrawn(drawn);
  });
  return null;
}
