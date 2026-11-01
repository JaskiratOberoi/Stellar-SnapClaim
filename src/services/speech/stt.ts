/**
 * Speech-to-text wrapper around expo-speech-recognition.
 *
 * The native module only exists in a development or production build, not in
 * Expo Go, so it is loaded lazily and every entry point degrades to
 * "unavailable" instead of crashing. On web it uses the browser's Web Speech
 * API (Chrome and Safari; not available inside Electron).
 */

import { Platform } from 'react-native';

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

let cachedModule: SpeechModule | null | undefined;

function loadModule(): SpeechModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lib = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
    cachedModule = lib.ExpoSpeechRecognitionModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export type ListenHandlers = {
  /** Interim transcript while the user is still talking. */
  onPartial?: (transcript: string) => void;
  /** Final transcript once recognition settles. */
  onFinal?: (transcript: string) => void;
  /** Always fires last, after a final result, an error, or a manual stop. */
  onEnd?: () => void;
  onError?: (message: string) => void;
};

export function isSpeechRecognitionAvailable(): boolean {
  const module = loadModule();
  if (!module) return false;
  try {
    return module.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export function unavailableReason(): string {
  if (Platform.OS === 'web') {
    return 'Voice input needs a browser with the Web Speech API, such as Chrome or Safari.';
  }
  return 'Voice input needs a development build of the app; it is not included in Expo Go.';
}

/**
 * Start listening. Resolves with a function that tears down the listeners;
 * call `stopListening()` to end recognition early.
 */
export async function startListening(
  language: string,
  handlers: ListenHandlers,
): Promise<() => void> {
  const module = loadModule();
  if (!module) throw new Error(unavailableReason());

  if (Platform.OS !== 'web') {
    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone permission was not granted.');
    }
  }

  let finished = false;
  const subscriptions = [
    module.addListener('result', (event) => {
      const transcript = event.results[0]?.transcript ?? '';
      if (event.isFinal) handlers.onFinal?.(transcript);
      else handlers.onPartial?.(transcript);
    }),
    module.addListener('error', (event) => {
      if (event.error === 'aborted') return;
      handlers.onError?.(event.message || `Speech recognition error: ${event.error}`);
    }),
    module.addListener('end', () => {
      if (finished) return;
      finished = true;
      cleanup();
      handlers.onEnd?.();
    }),
  ];

  const cleanup = () => {
    for (const subscription of subscriptions) subscription.remove();
  };

  module.start({ lang: language, interimResults: true, continuous: false });
  return cleanup;
}

export function stopListening(): void {
  try {
    loadModule()?.stop();
  } catch {
    // Nothing to stop.
  }
}
