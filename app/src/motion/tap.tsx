import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

export type TapProps = Omit<PressableProps, 'style' | 'children'> & {
  /** Visual styles: background, padding, radius. They scale with the press. */
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** Layout-only styles for the pressable itself: flex, position. They do not scale. */
  outerStyle?: StyleProp<ViewStyle>;
  scale?: number;
  children?: ReactNode;
};

/** A pressable that answers the finger: it shrinks a touch while held and springs back on release. */
export function Tap({ style, outerStyle, scale = 0.97, onPressIn, onPressOut, children, ...rest }: TapProps) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(e) => {
        s.set(withTiming(scale, { duration: Motion.fast * 0.75 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withTiming(1, { duration: Motion.base, easing: Easing.out(Easing.cubic) }));
        onPressOut?.(e);
      }}>
      {(state) => <Animated.View style={[typeof style === 'function' ? style(state) : style, anim]}>{children}</Animated.View>}
    </Pressable>
  );
}
