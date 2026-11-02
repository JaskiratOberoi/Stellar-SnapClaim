import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/hooks/use-session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <Navigation />
      </SessionProvider>
    </ThemeProvider>
  );
}

// Phones get the native sheet; the web renders the route over the page as a Sheet of its own.
const sheet = { presentation: Platform.select({ web: 'transparentModal' as const, default: 'modal' as const }), animation: 'slide_from_bottom' as const };

function Navigation() {
  const { ready, user } = useSession();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  const signedIn = user !== null;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="claim/new" options={sheet} />
        <Stack.Screen name="claim/[id]" />
        <Stack.Screen name="receipt/[id]" options={sheet} />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/policy" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade', animationTypeForReplace: 'pop' }} />
      </Stack.Protected>
    </Stack>
  );
}
