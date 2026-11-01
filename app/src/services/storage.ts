import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Token storage: Keychain / Keystore on phones via expo-secure-store,
 * localStorage on the web (SecureStore has no web implementation).
 */
const native = Platform.OS !== 'web';

export async function getSecret(key: string): Promise<string | null> {
  if (native) return SecureStore.getItemAsync(key);
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function setSecret(key: string, value: string | null): Promise<void> {
  if (native) {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
    return;
  }
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // private mode or storage blocked: the session simply does not persist
  }
}
