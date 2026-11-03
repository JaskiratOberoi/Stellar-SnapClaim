import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, type ReactNode, type ComponentRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

export type EnterFrom = 'up' | 'right';

/**
 * The web stack has no push transition, so the page content arrives on its
 * own: a pushed page slides in from the right, a tab rises 8px. It replays,
 * shorter, each time the screen comes back into focus, so switching tabs
 * reads as a move and not a swap.
 */
export function PageEnter({ children, style, from = 'up' }: { children: ReactNode; style?: StyleProp<ViewStyle>; from?: EnterFrom }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      const el = dom(ref);
      if (!el || reducedMotion()) return;
      const initial = first.current;
      first.current = false;
      const tween = gsap.from(el, {
        y: from === 'up' ? (initial ? 8 : 6) : 0,
        x: from === 'right' ? 18 : 0,
        autoAlpha: 0,
        duration: initial ? 0.36 : 0.28,
        ease: EASE,
        clearProps: 'transform,opacity,visibility',
      });
      return () => {
        tween.kill();
        gsap.set(el, { clearProps: 'transform,opacity,visibility' });
      };
    }, [from]),
  );
  return (
    <View ref={ref} style={style}>
      {children}
    </View>
  );
}
