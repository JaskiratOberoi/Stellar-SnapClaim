import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { GroupCard } from '@/components/group-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Presence } from '@/motion/presence';

const DISMISS_KEY = 'snapclaim.install.dismissed';

/** Chrome and Edge hand the page an install prompt it can show later; it is kept here from the moment the bundle loads. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

type Kind = 'ios' | 'android' | 'desktop';

function device(): Kind {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

function installed(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function dismissed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

const share: SymbolViewProps['name'] = { ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' };
const menu: SymbolViewProps['name'] = { ios: 'ellipsis', android: 'more_vert', web: 'more_vert' };
const add: SymbolViewProps['name'] = { ios: 'plus.app', android: 'add_to_home_screen', web: 'add_to_home_screen' };
const browser: SymbolViewProps['name'] = { ios: 'macwindow', android: 'install_desktop', web: 'install_desktop' };

/** The hand-done steps for the browsers that do not offer a prompt. */
function steps(kind: Kind): { icon: SymbolViewProps['name']; text: string }[] {
  if (kind === 'ios') {
    return [
      { icon: share, text: 'In Safari, tap Share at the bottom of the screen.' },
      { icon: add, text: 'Choose Add to Home Screen, then Add.' },
    ];
  }
  if (kind === 'android') {
    return [
      { icon: menu, text: 'Open the browser menu at the top right.' },
      { icon: add, text: 'Tap Install app, or Add to Home screen.' },
    ];
  }
  return [
    { icon: browser, text: 'In Chrome or Edge, click the install icon at the right end of the address bar.' },
    { icon: add, text: 'Confirm, and SnapClaim opens in its own window from now on.' },
  ];
}

/**
 * On the web, until it is installed: put SnapClaim on the home screen. Where
 * the browser offers a prompt (Chrome, Edge) one tap installs it; elsewhere
 * the two steps are spelled out for that device. Gone once installed, once
 * dismissed, and when already running as the installed app.
 */
export function InstallCard() {
  const theme = useTheme();
  const [hidden, setHidden] = useState(() => Platform.OS !== 'web' || installed() || dismissed());
  const [canPrompt, setCanPrompt] = useState(() => deferred !== null);
  const kind = device();

  useEffect(() => {
    const sync = () => {
      setCanPrompt(deferred !== null);
      if (installed()) setHidden(true);
    };
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode: the card simply shows again next time.
    }
    setHidden(true);
  };
  const install = async () => {
    const p = deferred;
    if (!p) return;
    await p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') setHidden(true);
  };

  const subtitle = kind === 'desktop' ? 'Its own window, one click from the taskbar.' : 'One tap from your home screen.';

  return (
    <Presence visible={!hidden} y={10} style={styles.wrap}>
      <GroupCard
        tone="sage"
        icon={{ ios: 'square.and.arrow.down.on.square', android: 'add_to_home_screen', web: 'add_to_home_screen' }}
        kicker={kind === 'desktop' ? 'Desktop app' : 'Home screen app'}
        title={kind === 'desktop' ? 'Install as an app' : 'Add to home screen'}
        subtitle={subtitle}
        footer={
          <>
            {canPrompt ? <Button title="Install SnapClaim" icon={{ ios: 'arrow.down.circle.fill', android: 'install_mobile', web: 'install_mobile' }} compact onPress={install} /> : null}
            <Button title={canPrompt ? 'Not now' : 'Got it'} variant={canPrompt ? 'ghost' : 'secondary'} compact onPress={dismiss} />
          </>
        }>
        <View style={styles.body}>
          {canPrompt ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing to download. The browser adds it to your {kind === 'desktop' ? 'desktop' : 'home screen'} and keeps it up to date.
            </ThemedText>
          ) : (
            steps(kind).map((s, i) => (
              <View key={s.text} style={styles.step}>
                <View style={[styles.num, { backgroundColor: theme.accentSoft }]}>
                  <SymbolView name={s.icon} size={16} tintColor={theme.accentStrong} />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.stepText}>
                  <ThemedText type="smallSemi" themeColor="textSecondary">
                    {i + 1}.{' '}
                  </ThemedText>
                  {s.text}
                </ThemedText>
              </View>
            ))
          )}
        </View>
      </GroupCard>
    </Presence>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.three },
  body: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one, gap: Spacing.two },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + Spacing.half },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, lineHeight: 20 },
});
