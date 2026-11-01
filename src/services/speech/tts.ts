/**
 * Text-to-speech wrapper around expo-speech. Works on Android, iOS and web
 * (including the Electron desktop build, which has the browser speech engine).
 */

import * as Speech from 'expo-speech';

export type SpeakOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  onDone?: () => void;
};

export function speak(text: string, options: SpeakOptions = {}): void {
  if (!text.trim()) return;
  Speech.speak(text, {
    language: options.language,
    rate: options.rate ?? 1,
    pitch: options.pitch ?? 1,
    onDone: options.onDone,
    onStopped: options.onDone,
    onError: options.onDone,
  });
}

export async function stopSpeaking(): Promise<void> {
  await Speech.stop();
}

export function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}
