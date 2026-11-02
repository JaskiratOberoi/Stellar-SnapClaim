import { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';

import { Motion } from '@/constants/theme';

type Props = TextProps & { value: number; format: (n: number) => string };

/** A number that rolls to its new value instead of jumping. */
export function CountUp({ value, format, ...rest }: Props) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = Date.now();
    let frame = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / Motion.slow);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(start + (value - start) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <Text {...rest}>{format(shown)}</Text>;
}
