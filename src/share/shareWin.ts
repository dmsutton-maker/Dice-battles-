import { Share } from 'react-native';

/**
 * Hand the finished card to the phone's share sheet.
 *
 * `Share.share` is React Native's own wrapper around
 * UIActivityViewController — the same one FriendsScreen uses for a
 * friend code — so there is no new dependency and it goes out over the
 * air. Given a `file://` picture, iOS offers Instagram, Messages, Save
 * Image and the rest.
 *
 * NOTHING HERE IS ALLOWED TO THROW. Swiping the sheet away is the most
 * ordinary thing a person can do with it, and an unhandled rejection in
 * a screen is a red box over a win. Only the picture goes: no message,
 * no name, nothing typed by anybody.
 */
export type ShareOutcome = 'shared' | 'dismissed' | 'failed';

export async function shareCardFile(uri: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ url: uri });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    // No sheet to show, or the file could not be read. Say so plainly
    // in the sheet; nobody has lost anything.
    return 'failed';
  }
}
