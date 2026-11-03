import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { GroupCard } from '@/components/group-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Presence } from '@/motion/presence';
import { API_URL } from '@/services/api';

type Latest = { version: string; build: number; size: number; path: string };

const DISMISS_KEY = 'snapclaim.getapp.dismissed';

function device(): 'android' | 'ios' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

function installed(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches;
}

function dismissed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * On the web, on first use: the Android app the site serves at /downloads.
 * Android gets the download itself; a desktop gets it to send across to the
 * phone. Nothing on iPhone (no APK there), nothing until a build is published,
 * and nothing once dismissed or when already running as the installed app.
 */
export function GetAppCard() {
  const [hidden, setHidden] = useState(() => Platform.OS !== 'web' || installed() || dismissed() || device() === 'ios');
  const [latest, setLatest] = useState<Latest | null>(null);
  const kind = device();

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    fetch(`${API_URL}/downloads/latest.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<Latest>) : null))
      .then((j) => {
        if (!cancelled && j) setLatest(j);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hidden]);

  if (Platform.OS !== 'web') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode: the card simply shows again next time.
    }
    setHidden(true);
  };
  const apk = latest ? `${API_URL}${latest.path}` : null;
  const download = () => {
    if (apk) window.location.href = apk;
  };
  const sizeNote = latest ? `${Math.round(latest.size / 1024 / 1024)} MB · v${latest.version} (${latest.build})` : '';

  return (
    <Presence visible={!hidden && apk !== null} y={10} style={styles.wrap}>
      <GroupCard
        tone="sage"
        icon={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }}
        kicker="Android app"
        title="Get the app"
        subtitle={kind === 'android' ? 'Snap receipts with the camera, straight from your home screen.' : 'SnapClaim works best on an Android phone, where the camera snaps the bill.'}
        footer={
          <>
            <Button title={kind === 'android' ? 'Download for Android' : 'Download the Android app'} icon={{ ios: 'arrow.down.circle.fill', android: 'download', web: 'download' }} compact onPress={download} />
            <Button title="Not now" variant="ghost" compact onPress={dismiss} />
          </>
        }>
        <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {kind === 'android'
              ? `Download the app, open the file, and allow installs from your browser when Android asks. ${sizeNote}.`
              : `Download the installer and send it to the phone, or open expense.genomicslab.in there to get it directly. ${sizeNote}.`}
          </ThemedText>
        </View>
      </GroupCard>
    </Presence>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.three },
  body: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one },
});
