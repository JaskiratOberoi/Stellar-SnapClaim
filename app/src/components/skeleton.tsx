import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A placeholder block that breathes while the real content loads. */
export function Bone({ width, height = 14, radius = 7, style }: { width: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected, opacity: pulse }, style]} />;
}

/** The shape of a card of claim rows, before the rows arrive. */
export function ClaimsSkeleton({ rows = 3 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View accessibilityLabel="Loading claims" style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.head}>
        <Bone width={44} height={44} radius={22} />
        <View style={styles.titles}>
          <Bone width={64} height={10} />
          <Bone width={140} height={18} radius={9} />
        </View>
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.row, { borderTopColor: theme.border }]}>
          <View style={styles.titles}>
            <Bone width={`${55 + ((i * 17) % 30)}%`} height={14} />
            <Bone width={`${35 + ((i * 23) % 25)}%`} height={10} />
          </View>
          <Bone width={72} height={20} radius={10} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.three, borderRadius: Radius.medium, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  titles: { flex: 1, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three, borderTopWidth: StyleSheet.hairlineWidth },
});
