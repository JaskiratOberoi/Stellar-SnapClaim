import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = { size: number; color: string; count?: number; style?: StyleProp<ViewStyle> };

/**
 * Concentric, slightly irregular rings, like contour lines on a map: the quiet
 * texture behind the month figure. Plain Views, so it draws the same on web and phones.
 */
export function ContourRings({ size, color, count = 8, style }: Props) {
  return (
    <View pointerEvents="none" style={[styles.root, { width: size, height: size }, style]}>
      {Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        const w = size * (0.34 + 0.66 * t);
        const h = size * (0.3 + 0.68 * t);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: w,
              height: h,
              borderRadius: size,
              borderWidth: 1,
              borderColor: color,
              opacity: 0.42 - 0.3 * t,
              transform: [{ rotate: `${-22 + i * 9}deg` }, { translateX: (i % 2 ? 1 : -1) * t * size * 0.025 }, { translateY: t * size * 0.02 }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
