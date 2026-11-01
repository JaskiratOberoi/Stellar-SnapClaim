import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PolicyFlag } from '@/services/types';

/** Policy flags as the employee and the manager both see them. */
export function FlagList({ flags, compact }: { flags: PolicyFlag[]; compact?: boolean }) {
  const theme = useTheme();
  if (flags.length === 0) return null;
  return (
    <View style={[styles.list, compact && styles.compact]}>
      {flags.map((flag) => {
        const block = flag.severity === 'block';
        return (
          <View key={flag.code + flag.message} style={[styles.flag, { backgroundColor: block ? theme.dangerSoft : theme.warningSoft }]}>
            <SymbolView
              name={block ? { ios: 'xmark.octagon.fill', android: 'block', web: 'block' } : { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              size={16}
              tintColor={block ? theme.danger : theme.warning}
            />
            <ThemedText type="small" style={[styles.text, { color: block ? theme.danger : theme.warning }]}>
              {flag.message}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  compact: { paddingHorizontal: 0 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two + Spacing.half, borderRadius: Radius.small },
  text: { flex: 1, fontWeight: 600 },
});
