import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

/**
 * The SnapClaim mark arriving: the tile snaps into place, a shutter flash
 * crosses it, and the glyph settles. One authored moment, 700 ms, once.
 */
export function SnapMark({ size = 72 }: { size?: number }) {
  const theme = useTheme();
  const mark = useRef<ComponentRef<typeof View>>(null);
  const flash = useRef<ComponentRef<typeof View>>(null);
  const glyph = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const m = dom(mark);
    const f = dom(flash);
    const g = dom(glyph);
    if (!m || !f || !g || reducedMotion()) return;
    // react-native-web keeps the flash's opacity inline, so it is hidden with set(), never clearProps.
    const tl = gsap.timeline();
    tl.from(m, { scale: 0.55, rotate: -8, autoAlpha: 0, duration: 0.6, ease: EASE }, 0)
      .fromTo(f, { autoAlpha: 0.95, scaleX: 0.2, transformOrigin: 'left center' }, { autoAlpha: 0, scaleX: 1.4, duration: 0.42, ease: 'power2.out', immediateRender: false }, 0.18)
      .from(g, { scale: 0.7, autoAlpha: 0, duration: 0.45, ease: EASE }, 0.22)
      .set([m, g], { clearProps: 'transform,opacity,visibility' })
      .set(f, { autoAlpha: 0 });
    return () => {
      tl.kill();
      gsap.set([m, g], { clearProps: 'transform,opacity,visibility' });
      gsap.set(f, { autoAlpha: 0 });
    };
  }, []);
  return (
    <View ref={mark} style={[styles.mark, { width: size, height: size, backgroundColor: theme.accent }]}>
      <View ref={glyph} style={styles.glyph}>
        <ThemedText style={[styles.text, { color: theme.textOnAccent, fontSize: size * 0.62, lineHeight: size * 0.7 }]}>S</ThemedText>
        <View style={[styles.lens, { borderColor: theme.textOnAccent, width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1 }]} />
      </View>
      <View ref={flash} pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#F8F4EF', opacity: 0 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glyph: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Fonts.serif, letterSpacing: -1 },
  lens: { position: 'absolute', right: -14, bottom: -4, borderWidth: 2.5, opacity: 0.9 },
});
