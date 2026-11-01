import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsProvider, useSettings } from '@/hooks/use-settings';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or not supported on this platform.
});

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Navigation />
    </SettingsProvider>
  );
}

function Navigation() {
  const scheme = useColorScheme();
  const { ready } = useSettings();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: palette.background },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings', presentation: 'modal', headerShown: true }}
        />
      </Stack>
    </ThemeProvider>
  );
}
