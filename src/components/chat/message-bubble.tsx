import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/services/assistant';

type Props = {
  message: ChatMessage;
};

export function MessageBubble({ message }: Props) {
  const theme = useTheme();
  const isUser = message.role === 'user';

  const bubbleColor = message.error
    ? theme.backgroundElement
    : isUser
      ? theme.userBubble
      : theme.assistantBubble;
  const textColor = message.error ? theme.danger : isUser ? theme.textOnAccent : theme.text;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          { backgroundColor: bubbleColor },
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          message.error && { borderColor: theme.danger, borderWidth: StyleSheet.hairlineWidth },
        ]}
        accessibilityRole="text"
        accessibilityLabel={`${isUser ? 'You' : 'Assistant'} said: ${message.text}`}>
        <ThemedText style={[styles.text, { color: textColor }]} selectable>
          {message.text}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.half,
    borderRadius: Radius.large,
  },
  bubbleUser: {
    borderBottomRightRadius: Radius.small,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: Radius.small,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 400,
  },
});
