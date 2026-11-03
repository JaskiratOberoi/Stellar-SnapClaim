import { useEffect, useState } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { Tones, type ToneName } from '@/constants/theme';

const RING = 2 * Math.PI * 20;
const TICK = 30;

/**
 * A seal that draws itself: the ring sweeps round, then the tick is struck.
 * One authored moment for the moment a claim is sent. Runs once on mount.
 */
export function CheckDraw({ size = 56, tone = 'green', delay = 150 }: { size?: number; tone?: ToneName; delay?: number }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const t0 = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / 900));
      setP(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [delay]);
  // The ring takes the first 60%, the tick the rest.
  const ring = Math.min(1, p / 0.6);
  const tick = Math.max(0, (p - 0.55) / 0.45);
  const t = Tones[tone];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx={24} cy={24} r={20} fill={t.soft} />
      <Circle cx={24} cy={24} r={20} stroke={t.base} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${RING} ${RING}`} strokeDashoffset={RING * (1 - ring)} transform="rotate(-90 24 24)" />
      <Path d="M15 24.5 L21 30.5 L33.5 17.5" stroke={t.base} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${TICK} ${TICK}`} strokeDashoffset={TICK * (1 - tick)} />
    </Svg>
  );
}
