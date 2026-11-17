/**
 * The iCloud key-value store module (modules/icloud-store), or null.
 *
 * NATIVE CODE AND OVER-THE-AIR UPDATES (AGENTS.md). The module is new in
 * the build after 18; JavaScript that names it ships over the air to
 * build 18 as well, which does not contain it. So it is looked up with
 * `requireOptionalNativeModule`, which returns null for a module the
 * binary lacks instead of throwing — the reason `runtimeVersion` did not
 * have to be raised for it. Never `requireNativeModule` here: that one
 * throws, and a throwing module factory red-screens the game before the
 * menu (25 Aug 2026). tests/cloudSave.test.ts holds this file to that.
 *
 * Required lazily, inside the function, like every native lookup here.
 * iOS only: Android has no iCloud, and returns null.
 */
export interface ICloudStore {
  isSignedIn(): boolean;
  synchronize(): boolean;
  getString(key: string): string | null;
  setString(key: string, value: string): boolean;
  remove(key: string): boolean;
  keys(): string[];
}

let cached: ICloudStore | null | undefined;
let fake: ICloudStore | null | undefined;

export function loadCloudStore(): ICloudStore | null {
  if (fake !== undefined) return fake;
  if (cached !== undefined) return cached;
  cached = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    if (Platform.OS !== 'ios') return cached;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireOptionalNativeModule } = require('expo');
    cached = (requireOptionalNativeModule('ICloudStore') as ICloudStore | null) ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Tests only: stand a fake store in for the native one (null = none). */
export function useFakeCloudStoreForTest(store: ICloudStore | null | undefined): void {
  fake = store;
}
