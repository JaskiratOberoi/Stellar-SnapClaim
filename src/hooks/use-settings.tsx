import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_SETTINGS,
  loadApiKey,
  loadSettings,
  saveApiKey,
  saveSettings,
  type Settings,
} from '@/services/storage/settings-store';

type SettingsContextValue = {
  settings: Settings;
  claudeApiKey: string | null;
  /** False until the stored values have been read from disk. */
  ready: boolean;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  setClaudeApiKey: (apiKey: string | null) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [claudeApiKey, setClaudeApiKeyState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSettings(), loadApiKey()]).then(([stored, key]) => {
      if (cancelled) return;
      latest.current = stored;
      setSettings(stored);
      setClaudeApiKeyState(key);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setSettings(next);
    await saveSettings(next);
  }, []);

  const setClaudeApiKey = useCallback(async (apiKey: string | null) => {
    const trimmed = apiKey?.trim() || null;
    setClaudeApiKeyState(trimmed);
    await saveApiKey(trimmed);
  }, []);

  const value = useMemo(
    () => ({ settings, claudeApiKey, ready, updateSettings, setClaudeApiKey }),
    [settings, claudeApiKey, ready, updateSettings, setClaudeApiKey],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
