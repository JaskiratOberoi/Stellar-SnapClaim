import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which guided tours and first-time hints a person has already seen, per user,
 * so a colleague signing in on the same phone still gets their own welcome.
 * AsyncStorage is the device's own store (localStorage on the web).
 */
export type Seen = Record<string, true>;

const key = (userId: string) => `snapclaim.guide.v1.${userId}`;

export async function loadSeen(userId: string): Promise<Seen> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as Seen) : {};
  } catch {
    return {};
  }
}

export async function saveSeen(userId: string, seen: Seen): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(seen));
  } catch {
    // Storage blocked: the tour shows again next time, which is harmless.
  }
}

export async function clearSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // Nothing to clear.
  }
}
