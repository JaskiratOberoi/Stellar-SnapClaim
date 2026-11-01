import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { currentLocale } from '@/hooks/use-chat';
import { useStore } from '@/hooks/use-store';
import { useTheme } from '@/hooks/use-theme';
import { runCommand } from '@/services/assistant/actions';
import { parseCommand, type Command } from '@/services/nlp/parse-command';

type Props = {
  placeholder: string;
  /** Restrict what the bar accepts; anything else is sent to the assistant chat. */
  accept?: Command['kind'][];
  /** Default command when plain text is typed with no verb, e.g. a bare task title. */
  fallback?: 'task' | 'expense';
};

/**
 * One-line natural-language entry. "call Ravi tomorrow 5pm" becomes a task,
 * "250 lunch" an expense. Sentences it cannot parse open the assistant chat.
 */
export function QuickAdd({ placeholder, accept, fallback }: Props) {
  const theme = useTheme();
  const store = useStore();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    let command = parseCommand(trimmed);
    if (command && accept && !accept.includes(command.kind)) command = null;
    if (!command && fallback === 'task') {
      command = parseCommand(`add task ${trimmed}`);
    }
    if (!command && fallback === 'expense') {
      command = parseCommand(`spent ${trimmed}`);
    }
    if (!command) {
      setText('');
      router.push({ pathname: '/chat', params: { q: trimmed } });
      return;
    }

    setBusy(true);
    try {
      const result = await runCommand(command, { store, locale: currentLocale() });
      setText('');
      showNotice(result.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <TextInput
          style={[styles.input, { color: theme.text, fontFamily: Fonts.sans }]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          blurOnSubmit={false}
          accessibilityLabel={placeholder}
        />
        <IconButton
          ios="plus"
          material="add"
          label="Add"
          onPress={() => void submit()}
          primary
          disabled={!text.trim() || busy}
          size={32}
        />
      </View>
      {notice ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.notice} numberOfLines={2}>
          {notice}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? Spacing.one : 0,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null),
  },
  notice: {
    paddingHorizontal: Spacing.two,
  },
});
