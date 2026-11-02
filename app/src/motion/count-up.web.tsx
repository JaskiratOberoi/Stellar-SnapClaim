import { useEffect, useRef, type ComponentRef } from 'react';
import { Text, type TextProps } from 'react-native';

import { dom, EASE, gsap, reducedMotion } from '@/motion/web';

type Props = TextProps & { value: number; format: (n: number) => string };

/** A number that rolls to its new value. GSAP tweens a proxy and writes the text node directly, no re-renders. */
export function CountUp({ value, format, ...rest }: Props) {
  const ref = useRef<ComponentRef<typeof Text>>(null);
  const from = useRef(value);
  useEffect(() => {
    const el = dom(ref);
    const start = from.current;
    from.current = value;
    if (!el || start === value || reducedMotion()) return;
    const proxy = { v: start };
    const tween = gsap.to(proxy, {
      v: value,
      duration: 0.6,
      ease: EASE,
      onUpdate: () => {
        el.textContent = format(proxy.v);
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, format]);
  return (
    <Text ref={ref} {...rest}>
      {format(value)}
    </Text>
  );
}
