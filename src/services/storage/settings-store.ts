/**
 * Persistence for user settings.
 *
 * Ordinary preferences go to AsyncStorage (works on every platform). The Claude
 * API key is a secret, so it goes to expo-secure-store on Android and iOS and
 * to localStorage on web, where secure-store is not available.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { ProviderPreference } from '@/services/assistant';

export type Settings = {
  userName: string;
  provider: ProviderPreference;
  speakReplies: boolean;
  /** BCP 47 tag used for both speech recognition and text-to-speech. */
  voiceLanguage: string;
};

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  provider: 'auto',
  speakReplies: true,
  voiceLanguage: 'en-US',
};

const SETTINGS_KEY = 'assistant.settings.v1';
const API_KEY_KEY = 'assistant.claude-api-key';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadApiKey(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(API_KEY_KEY);
    }
    const SecureStore = await import('expo-secure-store');
    return await SecureStore.getItemAsync(API_KEY_KEY);
  } catch {
    return null;
  }
}

export async function saveApiKey(apiKey: string | null): Promise<void> {
  const trimmed = apiKey?.trim() ?? '';
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return;
    if (trimmed) localStorage.setItem(API_KEY_KEY, trimmed);
    else localStorage.removeItem(API_KEY_KEY);
    return;
  }
  const SecureStore = await import('expo-secure-store');
  if (trimmed) await SecureStore.setItemAsync(API_KEY_KEY, trimmed);
  else await SecureStore.deleteItemAsync(API_KEY_KEY);
}
