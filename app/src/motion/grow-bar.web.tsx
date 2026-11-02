import { useEffect, useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

type Props = { fraction: number; color: string; trackColor: string; delay?: number; height?: number };

/** A proportion bar that grows from the left to its share. */
export function GrowBar({ fraction, color, trackColor, delay = 0, height = 6 }: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const el = dom(ref);
    if (!el || reducedMotion()) return;
    const tween = gsap.from(el, { scaleX: 0, transformOrigin: 'left center', duration: 0.7, delay: delay / 1000, ease: EASE, clearProps: 'transform' });
    return () => {
      tween.kill();
    };
  }, [delay]);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <View ref={ref} style={{ width: `${Math.max(2, fraction * 100)}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
});
