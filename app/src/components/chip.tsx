import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Tones, type ToneName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';
import { webTransition } from '@/motion/transition';

type Props = { label: string; selected?: boolean; onPress?: () => void; tone?: ToneName; icon?: SymbolViewProps['name'] };

/** An outlined pill in its tone: soft fill, base hairline, ink text. Selected, it fills with the base. */
export function Chip({ label, selected, onPress, tone = 'sage', icon }: Props) {
  const theme = useTheme();
  const t = Tones[tone];
  const fg = selected ? '#FFFFFF' : t.ink;
  return (
    <Tap
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      scale={0.95}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? t.base : pressed ? theme.backgroundSelected : t.soft, borderColor: t.base }, webTransition('background-color')]}>
      {icon ? <SymbolView name={icon} size={15} tintColor={fg} /> : null}
      <ThemedText type="smallSemi" style={{ color: fg }} numberOfLines={1}>
        {label}
      </ThemedText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + Spacing.half, paddingLeft: Spacing.two + Spacing.one, paddingRight: Spacing.three, minHeight: 38, borderRadius: Radius.pill, borderWidth: 1 },
});
