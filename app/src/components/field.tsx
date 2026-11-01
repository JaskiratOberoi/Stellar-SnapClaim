import { type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & { label: string; hint?: string; error?: string | null; trailing?: ReactNode; prefix?: string };

export function Field({ label, hint, error, trailing, prefix, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : 'transparent' }]}>
        {prefix ? (
          <ThemedText themeColor="textSecondary" style={styles.prefix}>
            {prefix}
          </ThemedText>
        ) : null}
        <TextInput
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }, style]}
          {...rest}
        />
        {trailing}
      </View>
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one, flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    minHeight: 46,
  },
  prefix: { marginRight: Spacing.one },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two, outlineWidth: 0 },
  group: { flexDirection: 'row', gap: Spacing.two },
});
