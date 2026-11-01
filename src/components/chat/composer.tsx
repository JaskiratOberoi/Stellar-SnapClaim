import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onToggleMic: () => void;
  listening: boolean;
  busy: boolean;
  /** Short status under the input: listening hint, voice error, and so on. */
  status?: string | null;
  statusTone?: 'neutral' | 'danger';
};

export function Composer({
  value,
  onChangeText,
  onSend,
  onToggleMic,
  listening,
  busy,
  status,
  statusTone = 'neutral',
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !busy;

  return (
    <View style={styles.wrapper}>
      {status ? (
        <ThemedText
          type="small"
          style={[styles.status, { color: statusTone === 'danger' ? theme.danger : theme.textSecondary }]}>
          {status}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: focused ? theme.accent : theme.border,
          },
        ]}>
        <IconButton
          ios={listening ? 'stop.fill' : 'mic.fill'}
          material={listening ? 'stop' : 'mic'}
          label={listening ? 'Stop listening' : 'Speak'}
          onPress={onToggleMic}
          active={listening}
          disabled={busy}
          size={36}
        />
        <TextInput
          style={[styles.input, { color: theme.text, fontFamily: Fonts.sans }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={listening ? 'Listening…' : 'Ask me anything'}
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={4000}
          editable={!listening}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          blurOnSubmit={Platform.OS !== 'web'}
          onSubmitEditing={Platform.OS !== 'web' ? onSend : undefined}
          onKeyPress={
            Platform.OS === 'web'
              ? (event) => {
                  const native = event.nativeEvent as { key?: string; shiftKey?: boolean };
                  if (native.key === 'Enter' && !native.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }
              : undefined
          }
          returnKeyType="send"
          accessibilityLabel="Message"
        />
        <IconButton
          ios="arrow.up"
          material="arrow_upward"
          label="Send"
          onPress={onSend}
          primary
          disabled={!canSend}
          size={36}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.one,
  },
  status: {
    paddingHorizontal: Spacing.two,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.large + Spacing.one,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 140,
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === 'ios' ? Spacing.two : Spacing.one + Spacing.half,
    fontSize: 16,
    lineHeight: 22,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
});
