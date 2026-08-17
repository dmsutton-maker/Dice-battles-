import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * One in-memory stand-in for the phone's storage, shared by every suite
 * that touches it. It has to be shared: each suite patching AsyncStorage
 * with its own map means the last one imported wins, and the others end up
 * writing to a map nothing reads.
 */
export const store = new Map<string, string>();

(AsyncStorage as unknown as Record<string, unknown>).setItem = async (
  key: string,
  value: string,
) => {
  store.set(key, value);
};
(AsyncStorage as unknown as Record<string, unknown>).getItem = async (
  key: string,
) => store.get(key) ?? null;
(AsyncStorage as unknown as Record<string, unknown>).removeItem = async (
  key: string,
) => {
  store.delete(key);
};
