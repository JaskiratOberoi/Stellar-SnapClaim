import { Fraunces_400Regular, Fraunces_400Regular_Italic, useFonts } from '@expo-google-fonts/fraunces';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { Palette } from '@/constants/theme';
import { SessionProvider, useSession } from '@/hooks/use-session';

SplashScreen.preventAutoHideAsync();

const theme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: Palette.accent, background: Palette.background, card: Palette.background, text: Palette.text, border: Palette.border },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fraunces_400Regular, Fraunces_400Regular_Italic });
  return (
    <ThemeProvider value={theme}>
      <SessionProvider>
        <Navigation fontsLoaded={fontsLoaded} />
      </SessionProvider>
    </ThemeProvider>
  );
}

// Phones get the native sheet; the web renders the route over the page as a Sheet of its own.
const sheet = { presentation: Platform.select({ web: 'transparentModal' as const, default: 'modal' as const }), animation: 'slide_from_bottom' as const };

function Navigation({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready, user } = useSession();
  const show = ready && fontsLoaded;
  useEffect(() => {
    if (show) SplashScreen.hideAsync();
  }, [show]);
  if (!show) return null;
  const signedIn = user !== null;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: Palette.background } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="claim/new" options={sheet} />
        <Stack.Screen name="claim/[id]" />
        <Stack.Screen name="receipt/[id]" options={sheet} />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/policy" />
        <Stack.Screen name="admin/audit" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade', animationTypeForReplace: 'pop' }} />
      </Stack.Protected>
    </Stack>
  );
}
