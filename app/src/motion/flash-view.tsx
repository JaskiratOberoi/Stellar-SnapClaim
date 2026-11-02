import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Bump this to flash. 0 never flashes. */
  flashKey?: number;
  delay?: number;
  baseColor: string;
  flashColor: string;
};

/** A surface that lights up briefly when something lands in it, then settles back. */
export function FlashView({ children, style, flashKey = 0, delay = 0, baseColor, flashColor }: Props) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!flashKey) return;
    t.set(withDelay(delay, withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 700 }))));
  }, [flashKey, delay, t]);
  const anim = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, [0, 1], [baseColor, flashColor]) }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
