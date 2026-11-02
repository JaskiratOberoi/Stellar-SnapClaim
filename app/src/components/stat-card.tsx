import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Tones, type ToneName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CountUp } from '@/motion/count-up';
import { GrowBar } from '@/motion/grow-bar';

type Props = {
  tone: ToneName;
  icon: SymbolViewProps['name'];
  label: string;
  /** The short line at the top right: what is left, what is waiting. */
  trailing?: string;
  value: number;
  format: (n: number) => string;
  /** Printed after the figure, muted: "/ ₹60,000". */
  unit?: string;
  /** 0..1 fills the meter; omit it for a card without one. */
  fraction?: number;
  note?: string;
  children?: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** A tinted card after the reference: round icon badge, label, trailing line, one serif figure with its unit, a meter, a note. */
export function StatCard({ tone, icon, label, trailing, value, format, unit, fraction, note, children, delay = 0, style }: Props) {
  const theme = useTheme();
  const t = Tones[tone];
  return (
    <View style={[styles.card, { backgroundColor: t.soft }, style]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: t.base }]}>
          <SymbolView name={icon} size={16} tintColor="#FFFFFF" />
        </View>
        <ThemedText type="smallSemi" style={[styles.label, { color: t.ink }]} numberOfLines={1}>
          {label}
        </ThemedText>
        {trailing ? (
          <ThemedText type="small" style={{ color: t.ink }} numberOfLines={1}>
            {trailing}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.figureRow}>
        <CountUp value={value} format={format} style={[styles.figure, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit />
        {unit ? (
          <ThemedText style={[styles.unit, { color: t.ink }]} numberOfLines={1}>
            {unit}
          </ThemedText>
        ) : null}
      </View>
      {fraction !== undefined ? <GrowBar fraction={Math.min(1, Math.max(0, fraction))} color={t.base} trackColor={theme.track} height={12} delay={delay + 120} /> : null}
      {note ? (
        <ThemedText type="caption" style={{ color: t.ink }}>
          {note}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.medium, padding: Spacing.three + Spacing.one, gap: Spacing.two + Spacing.half },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + Spacing.half },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two, flexWrap: 'wrap' },
  figure: { fontFamily: 'Fraunces_400Regular', fontSize: 48, lineHeight: 58, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 16, lineHeight: 22 },
});
