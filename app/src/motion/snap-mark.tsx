import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The SnapClaim mark arriving: it pops in like a shutter opening. */
export function SnapMark({ size = 72 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Animated.View entering={ZoomIn.duration(520)} style={[styles.mark, { width: size, height: size, backgroundColor: theme.accent }]}>
      <Animated.View entering={FadeIn.delay(200).duration(260)} style={styles.glyph}>
        <ThemedText style={[styles.text, { color: theme.textOnAccent, fontSize: size * 0.62, lineHeight: size * 0.7 }]}>S</ThemedText>
        <View style={[styles.lens, { borderColor: theme.textOnAccent, width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1 }]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mark: { borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glyph: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: Fonts.serif, letterSpacing: -1 },
  lens: { position: 'absolute', right: -14, bottom: -4, borderWidth: 2.5, opacity: 0.9 },
});
