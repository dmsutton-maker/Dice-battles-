/**
 * Counting real frames, with no React and no GL around it.
 *
 * It lives in its own file for the same reason src/arena/arenaArt.ts
 * does: the headless test suite is plain node with no bundler, and
 * importing anything that reaches React Native fails to transform. Put
 * this in FirstFrame.tsx beside its one caller and `npm test` dies on
 * `node_modules/react-native/index.js` before a single test runs.
 *
 * So the logic that can be tested is kept where it can be, and
 * FirstFrame.tsx is left as the thin piece that cannot: a `useFrame`
 * subscription and nothing else.
 */

/** How many real frames prove a scene is on screen. See the note above. */
export const FRAMES_TO_TRUST = 2;

/**
 * The counting, with no React and no GL around it, so the headless suite
 * exercises the same code the game runs rather than a copy of it.
 *
 * `tick` is called once per rendered frame and returns the token at the
 * moment it becomes trustworthy — once, never again until the token
 * changes. Everything below hangs on that "once": the caller sets React
 * state with it, and a watcher that reported every frame would re-render
 * the whole screen sixty times a second.
 */
export function createFrameWatch(): { tick: (token: string) => string | null } {
  let current: string | null = null;
  let seen = 0;
  return {
    tick(token) {
      if (current !== token) {
        current = token;
        seen = 0;
      }
      seen += 1;
      return seen === FRAMES_TO_TRUST ? token : null;
    },
  };
}
