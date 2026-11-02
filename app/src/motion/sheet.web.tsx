import { router } from 'expo-router';
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { PhoneWidth, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * The web presentation of a modal route: on a phone-width window a sheet slides
 * up over the page; on a wide one a dialog settles into the centre. Escape and
 * the scrim both close it.
 */
export function Sheet({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const phone = width < PhoneWidth;
  const scrim = useRef<ComponentRef<typeof Pressable>>(null);
  const panel = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const s = dom(scrim);
    const p = dom(panel);
    if (!s || !p || reducedMotion()) return;
    const tl = gsap.timeline();
    tl.from(s, { autoAlpha: 0, duration: 0.28, ease: 'power1.out' }, 0);
    if (phone) tl.from(p, { yPercent: 100, duration: 0.48, ease: EASE }, 0);
    else tl.from(p, { y: 28, scale: 0.98, autoAlpha: 0, duration: 0.42, ease: EASE }, 0.04);
    tl.set(p, { clearProps: 'transform,opacity,visibility' });
    return () => {
      tl.kill();
    };
  }, [phone]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable ref={scrim} accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} />
      <View
        ref={panel}
        accessibilityViewIsModal
        style={[
          phone ? styles.phone : styles.dialog,
          { backgroundColor: theme.surface, shadowColor: theme.shadow },
          phone ? { borderTopLeftRadius: Radius.large, borderTopRightRadius: Radius.large } : { borderRadius: Radius.large },
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  phone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 28,
    overflow: 'hidden',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
  },
  dialog: {
    width: '100%',
    maxWidth: 600,
    height: '88%',
    maxHeight: 820,
    overflow: 'hidden',
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
  },
});
