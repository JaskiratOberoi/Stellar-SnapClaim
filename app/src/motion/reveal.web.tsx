import { useEffect, useRef, type ReactNode, type ComponentRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

type Props = { children: ReactNode; delay?: number; y?: number; style?: StyleProp<ViewStyle> };

/** Content that arrives: a short rise-and-fade on mount, driven by GSAP from an already-visible default. */
export function Reveal({ children, delay = 0, y = 12, style }: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const el = dom(ref);
    if (!el || reducedMotion()) return;
    const tween = gsap.from(el, { y, autoAlpha: 0, duration: 0.5, delay: delay / 1000, ease: EASE, clearProps: 'transform,opacity,visibility' });
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: 'transform,opacity,visibility' });
    };
  }, [delay, y]);
  return (
    <View ref={ref} style={style}>
      {children}
    </View>
  );
}
