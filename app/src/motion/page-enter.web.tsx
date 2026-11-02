import { useEffect, useRef, type ReactNode, type ComponentRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

/** The web stack has no push transition, so the page content rises in once: 8px, a third of a second. */
export function PageEnter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const el = dom(ref);
    if (!el || reducedMotion()) return;
    const tween = gsap.from(el, { y: 8, autoAlpha: 0, duration: 0.36, ease: EASE, clearProps: 'transform,opacity,visibility' });
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: 'transform,opacity,visibility' });
    };
  }, []);
  return (
    <View ref={ref} style={style}>
      {children}
    </View>
  );
}
