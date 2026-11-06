import AsyncStorage from '@react-native-async-storage/async-storage';
import { shouldAskForReview } from './review';
import { loadStoreReviewSdk } from './storeReviewSdk';

/**
 * Show Apple's star sheet after a win, if the rule in review.ts says so.
 *
 * Never throws, never rejects, never blocks the game: a phone that cannot
 * show it (iPad without the App Store, a simulator, Apple's own yearly
 * limit) simply shows nothing, which is exactly what Apple's API does
 * too. The moment is remembered BEFORE asking, so a crash inside the
 * sheet cannot turn into asking on every win.
 */
const KEY = 'dice-battles/review-asked-at';

type StoreReviewSdk = {
  isAvailableAsync(): Promise<boolean>;
  requestReview(): Promise<void>;
};

export async function maybeAskForReview(totalWins: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const last = raw === null ? null : Number(raw);
    const now = Date.now();
    if (!shouldAskForReview(totalWins, last, now)) return;
    const sdk = loadStoreReviewSdk() as StoreReviewSdk | null;
    if (!sdk || !(await sdk.isAvailableAsync())) return;
    await AsyncStorage.setItem(KEY, String(now));
    await sdk.requestReview();
  } catch {
    // Nothing to tell the player: no sheet is the normal answer.
  }
}
