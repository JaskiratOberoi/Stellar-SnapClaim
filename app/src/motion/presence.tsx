import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

type Props = { visible: boolean; children: ReactNode; style?: StyleProp<ViewStyle>; y?: number };

/** Something that appears and leaves: rises in, drops out faster. */
export function Presence({ visible, children, style }: Props) {
  if (!visible) return null;
  return (
    <Animated.View entering={FadeInDown.duration(Motion.base)} exiting={FadeOutDown.duration(Motion.fast + 40)} style={style}>
      {children}
    </Animated.View>
  );
}
