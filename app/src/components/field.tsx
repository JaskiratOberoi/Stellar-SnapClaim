import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FlashView } from '@/motion/flash-view';
import { webTransition } from '@/motion/transition';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
  prefix?: string;
  /** Bump to light the field up, for a value that arrived on its own (read from a receipt). */
  flashKey?: number;
  flashDelay?: number;
};

/** A sunken field with a muted label, like the settings inputs in the reference; the border appears on focus. */
export function Field({ label, hint, error, trailing, prefix, style, flashKey, flashDelay, onFocus, onBlur, ...rest }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error ? theme.danger : focused ? theme.accent : 'transparent';
  return (
    <View style={styles.wrap}>
      <ThemedText type="label" themeColor="textMuted">
        {label}
      </ThemedText>
      <FlashView
        style={[styles.row, { borderColor: border }, webTransition('border-color, background-color')]}
        baseColor={theme.field}
        flashColor={theme.accentSoft}
        flashKey={flashKey}
        delay={flashDelay}>
        {prefix ? (
          <ThemedText themeColor="textMuted" style={styles.prefix}>
            {prefix}
          </ThemedText>
        ) : null}
        <TextInput
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.accent}
          style={[styles.input, { color: theme.text }, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailing}
      </FlashView>
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textMuted">
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
  wrap: { gap: Spacing.one + Spacing.half, flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three - 1,
    minHeight: 46,
  },
  prefix: { marginRight: Spacing.one },
  input: { flex: 1, fontSize: 16, paddingVertical: Spacing.two, outlineWidth: 0 },
  group: { flexDirection: 'row', gap: Spacing.two },
});
