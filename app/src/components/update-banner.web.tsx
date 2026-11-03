import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';

const CHECK_EVERY = 30 * 60 * 1000;

/**
 * Registers the service worker and watches for a newer build. When one has
 * installed and is waiting, a pill drops in from the top: one tap swaps the
 * worker and reloads onto the new version. Also checks whenever the page
 * comes back into view, so the installed app notices a deploy promptly.
 */
export function UpdateBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let reg: ServiceWorkerRegistration | null = null;
    let cancelled = false;
    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener('updatefound', () => {
        const next = r.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) setWaiting(next);
        });
      });
    };
    navigator.serviceWorker
      .register('/sw.js')
      .then((r) => {
        if (cancelled) return;
        reg = r;
        watch(r);
      })
      .catch(() => undefined);
    const check = () => {
      if (document.visibilityState === 'visible') reg?.update().catch(() => undefined);
    };
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener('visibilitychange', check);
    // The new worker has taken over: load the new build.
    let reloading = false;
    const onChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    };
  }, []);

  const update = () => {
    if (!waiting) return;
    setBusy(true);
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // If the worker never takes over (an odd browser), a plain reload still picks the build up.
    setTimeout(() => window.location.reload(), 4000);
  };

  return (
    <View style={[styles.root, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
      <Presence visible={waiting !== null} y={-16}>
        <View accessibilityLiveRegion="polite" style={[styles.pill, { backgroundColor: theme.text, shadowColor: theme.shadow }]}>
          <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor={theme.textOnAccent} />
          <ThemedText type="smallSemi" style={{ color: theme.textOnAccent }} numberOfLines={1}>
            A new version is ready
          </ThemedText>
          <Button title="Update" compact loading={busy} onPress={update} style={styles.button} />
        </View>
      </Presence>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.half,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    maxWidth: 420,
  },
  button: { minHeight: 32 },
});
