import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * How to play, as data.
 *
 * The words live here rather than inside the screen for the same reason
 * the mode rules do: they are the thing most likely to be wrong, and being
 * able to read all of them in one place — and check them in the test suite
 * against the rules the game actually implements — is how they stay true
 * when the game changes underneath them.
 *
 * Written for a family, not for children. Ages 5+ means nobody is shut out
 * at the bottom end, not that this is a kids' game: a grandparent picking
 * up a phone should get the same six screens and not feel talked down to.
 * So: short sentences, no jargon, and no baby talk.
 */

export type TutorialArt =
  /** The six prisoner colours in a row, as the jail holds them. */
  | { kind: 'palette' }
  /** Two dice showing the same colour — a match. */
  | { kind: 'match' }
  /** Two dice showing different colours — no match. */
  | { kind: 'miss' }
  /** A hand flicking, for the throw. */
  | { kind: 'throw' }
  /** The four modes, by emoji. */
  | { kind: 'modes' }
  /** A trophy and a coin. */
  | { kind: 'rewards' };

export interface TutorialPage {
  title: string;
  /** Two or three short lines. Each is its own paragraph on screen. */
  lines: string[];
  art: TutorialArt;
}

export const TUTORIAL_PAGES: TutorialPage[] = [
  {
    title: 'Six prisoners',
    lines: [
      'Six prisoners are locked in the castle jail — one of every colour.',
      'Your job is to get all six of them out.',
    ],
    art: { kind: 'palette' },
  },
  {
    title: 'Throw the dice',
    lines: [
      'Tap anywhere on the battlefield to roll.',
      'Or flick, and the dice go the way you flicked — harder for a bigger throw.',
      'You do not have to wait for them to stop. Tap again and the next roll is on its way.',
    ],
    art: { kind: 'throw' },
  },
  {
    title: 'Two the same frees one',
    lines: [
      'When BOTH dice land on the same colour, that prisoner runs free.',
      'Two different colours does nothing — just roll again.',
      'That is the whole game. Everything else is a twist on it.',
    ],
    art: { kind: 'match' },
  },
  {
    title: 'It is a race',
    lines: [
      'Somebody is rolling against you, and they are trying to empty their jail too.',
      'Free all six before they do and you win the battle.',
    ],
    art: { kind: 'miss' },
  },
  {
    title: 'Four ways to play',
    lines: [
      'Color Rush — free all six. The one to learn on.',
      'Ultimate — rolling a colour you already freed sends them BACK to jail.',
      'Skirmish — one shared jail, so you are grabbing prisoners off each other.',
      'Color War — you each get one colour, and race to free your three.',
    ],
    art: { kind: 'modes' },
  },
  {
    title: 'Trophies and coins',
    lines: [
      'Win and you earn trophies. They are your rank, and they go down when you lose.',
      'You earn coins too, and losing never takes those away. Spend them in the Store.',
      'Trophies unlock new battlefields and dice as you climb.',
    ],
    art: { kind: 'rewards' },
  },
];

const STORAGE_KEY = 'dice-battles:tutorial-seen';

let seen = false;

/**
 * Whether the tutorial has already been shown once.
 *
 * It opens on its own the first time and never again, because a tutorial
 * that reappears is worse than none — but it stays one tap away from the
 * home screen forever, since the person who needs it most is the one
 * handed the phone six months from now.
 */
export function hasSeenTutorial(): boolean {
  return seen;
}

export async function loadTutorialSeen(): Promise<boolean> {
  try {
    seen = (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    // Storage being unavailable should not mean the tutorial never opens,
    // so an unreadable flag counts as not yet seen.
    seen = false;
  }
  return seen;
}

export function markTutorialSeen(): void {
  seen = true;
  AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
}

/** Test-only reset so suites do not leak state between cases. */
export function resetTutorialForTests(value = false): void {
  seen = value;
}
