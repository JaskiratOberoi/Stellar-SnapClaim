import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

type Props = { fraction: number; color: string; trackColor: string; delay?: number; height?: number };

/** A proportion bar that grows from the left to its share. */
export function GrowBar({ fraction, color, trackColor, delay = 0, height = 6 }: Props) {
  const sx = useSharedValue(0);
  useEffect(() => {
    sx.set(withDelay(delay, withTiming(1, { duration: Motion.slow + 180, easing: Easing.out(Easing.exp) })));
  }, [sx, delay]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }] }));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}>
      <Animated.View style={[styles.fill, { width: `${Math.max(2, fraction * 100)}%`, height, borderRadius: height / 2, backgroundColor: color }, anim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden' },
  fill: { transformOrigin: 'left' },
});
