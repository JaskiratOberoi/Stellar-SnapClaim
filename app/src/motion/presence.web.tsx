import { useEffect, useRef, useState, type ReactNode, type ComponentRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

type Props = { visible: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; y?: number };

/**
 * Something that appears and leaves. The element stays mounted through its exit
 * tween (showing the last visible children), then unmounts.
 */
export function Presence({ visible, children, style, y = 16 }: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [shown, setShown] = useState(visible);
  const last = useRef<ReactNode>(children);
  useEffect(() => {
    if (visible) last.current = children;
  });
  useEffect(() => {
    const el = dom(ref);
    if (visible) {
      queueMicrotask(() => setShown(true));
      if (!el || reducedMotion()) return;
      const tween = gsap.fromTo(el, { y, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.32, ease: EASE, clearProps: 'transform,opacity,visibility' });
      return () => {
        tween.kill();
      };
    }
    if (!el || reducedMotion()) {
      queueMicrotask(() => setShown(false));
      return;
    }
    const tween = gsap.to(el, { y: y * 0.6, autoAlpha: 0, duration: 0.18, ease: 'power2.in', onComplete: () => setShown(false) });
    return () => {
      tween.kill();
    };
  }, [visible, y]);
  if (!visible && !shown) return null;
  return (
    <View ref={ref} style={style}>
      {/* eslint-disable-next-line react-hooks/refs -- the exit tween shows what was there */}
      {visible ? children : last.current}
    </View>
  );
}
