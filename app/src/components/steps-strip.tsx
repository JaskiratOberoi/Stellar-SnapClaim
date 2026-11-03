import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';
import { webTransition } from '@/motion/transition';

type Props = {
  steps: { label: string; done: boolean }[];
  onDismiss: () => void;
};

/**
 * First-time annotation on a form: the steps in order, each ticked as it is
 * done, the current one in the accent. Goes away for good once dismissed or
 * once the form has been sent.
 */
export function StepsStrip({ steps, onDismiss }: Props) {
  const theme = useTheme();
  const current = steps.findIndex((s) => !s.done);
  return (
    <View style={[styles.strip, { backgroundColor: theme.accentSoft }]} accessibilityRole="summary">
      {steps.map((s, i) => {
        const active = i === current;
        const fg = s.done || active ? theme.accentStrong : theme.textMuted;
        return (
          <View key={s.label} style={styles.step}>
            <View style={[styles.num, { backgroundColor: s.done || active ? theme.accent : 'transparent', borderColor: s.done || active ? theme.accent : theme.textMuted }, webTransition('background-color, border-color', 260)]}>
              {s.done ? (
                <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={12} tintColor="#FFFFFF" />
              ) : (
                <ThemedText type="caption" style={{ color: active ? '#FFFFFF' : theme.textMuted, fontWeight: 700 }}>
                  {i + 1}
                </ThemedText>
              )}
            </View>
            <ThemedText type={active ? 'smallSemi' : 'small'} style={{ color: fg }} numberOfLines={1}>
              {s.label}
            </ThemedText>
          </View>
        );
      })}
      <Tap accessibilityRole="button" accessibilityLabel="Hide these steps" hitSlop={8} scale={0.85} onPress={onDismiss} style={styles.close}>
        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor={theme.accentStrong} />
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginHorizontal: Spacing.three, marginTop: Spacing.two, paddingVertical: Spacing.two + Spacing.half, paddingLeft: Spacing.three, paddingRight: Spacing.two, borderRadius: Radius.small, flexWrap: 'wrap' },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  num: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
});
