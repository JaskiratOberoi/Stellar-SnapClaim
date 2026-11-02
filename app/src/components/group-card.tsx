import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Tones, type ToneName } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  tone: ToneName;
  icon: SymbolViewProps['name'];
  /** The small ink line above the title: a time in the reference, a count here. */
  kicker?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** A surface card with a coloured top rule and a round icon badge, like a meal in the reference; rows go inside, actions in the footer. */
export function GroupCard({ tone, icon, kicker, title, subtitle, trailing, children, footer, style }: Props) {
  const theme = useTheme();
  const t = Tones[tone];
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, borderTopColor: t.base }, style]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: t.base }]}>
          <SymbolView name={icon} size={20} tintColor="#FFFFFF" />
        </View>
        <View style={styles.titles}>
          {kicker ? (
            <ThemedText type="smallSemi" style={{ color: t.ink }}>
              {kicker}
            </ThemedText>
          ) : null}
          <ThemedText type="serif" numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" style={{ color: t.ink }} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {trailing}
      </View>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.three, borderRadius: Radius.medium, borderWidth: 1, borderTopWidth: 5, padding: Spacing.three, gap: Spacing.three },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: Spacing.half },
  body: { marginHorizontal: -Spacing.three },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
});
