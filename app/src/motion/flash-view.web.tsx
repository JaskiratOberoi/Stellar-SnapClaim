import { useEffect, useRef, type ReactNode, type ComponentRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { dom, gsap } from '@/motion/web';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  flashKey?: number;
  delay?: number;
  baseColor: string;
  flashColor: string;
};

/** A surface that lights up briefly when something lands in it, then settles back. */
export function FlashView({ children, style, flashKey = 0, delay = 0, baseColor, flashColor }: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const el = dom(ref);
    if (!el || !flashKey) return;
    const tween = gsap.fromTo(el, { backgroundColor: flashColor }, { backgroundColor: baseColor, duration: 0.9, delay: delay / 1000, ease: 'power2.out', clearProps: 'backgroundColor' });
    return () => {
      tween.kill();
    };
  }, [flashKey, delay, baseColor, flashColor]);
  return (
    <View ref={ref} style={[style, { backgroundColor: baseColor }]}>
      {children}
    </View>
  );
}
