import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

type Props = { children: ReactNode; delay?: number; y?: number; style?: StyleProp<ViewStyle> };

/** Content that arrives: a short rise-and-fade on mount. Phones use Reanimated; the web file uses GSAP. */
export function Reveal({ children, delay = 0, style }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(Motion.base + 60).delay(delay)} style={style}>
      {children}
    </Animated.View>
  );
}
