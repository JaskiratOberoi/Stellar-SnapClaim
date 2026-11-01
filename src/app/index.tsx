import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Composer } from '@/components/chat/composer';
import { MessageBubble } from '@/components/chat/message-bubble';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useChat } from '@/hooks/use-chat';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import type { ChatMessage } from '@/services/assistant';
import {
  isSpeechRecognitionAvailable,
  startListening,
  stopListening,
  unavailableReason,
} from '@/services/speech/stt';
import { speak, stopSpeaking } from '@/services/speech/tts';

const SUGGESTIONS = [
  'What time is it?',
  "What's today's date?",
  'What is 18% of 240?',
  'Plan my morning in three steps',
];

export default function ChatScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const { messages, isThinking, send, providerId } = useChat();

  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'neutral' | 'danger'>('neutral');
  const stopListeners = useRef<(() => void) | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    return () => {
      stopListeners.current?.();
      stopListening();
      void stopSpeaking();
    };
  }, []);

  const deliver = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setDraft('');
      setStatus(null);
      await stopSpeaking();
      const reply = await send(trimmed);
      if (reply && !reply.error && settings.speakReplies) {
        speak(reply.text, { language: settings.voiceLanguage });
      }
    },
    [send, settings.speakReplies, settings.voiceLanguage],
  );

  const toggleMic = useCallback(async () => {
    if (listening) {
      stopListening();
      return;
    }
    if (!isSpeechRecognitionAvailable()) {
      setStatusTone('danger');
      setStatus(unavailableReason());
      return;
    }
    try {
      await stopSpeaking();
      setStatusTone('neutral');
      setStatus('Listening… tap the square to stop.');
      setListening(true);
      stopListeners.current = await startListening(settings.voiceLanguage, {
        onPartial: (transcript) => setDraft(transcript),
        onFinal: (transcript) => {
          setDraft(transcript);
          void deliver(transcript);
        },
        onError: (message) => {
          setStatusTone('danger');
          setStatus(message);
        },
        onEnd: () => {
          setListening(false);
          setStatus((current) => (current?.startsWith('Listening') ? null : current));
        },
      });
    } catch (error) {
      setListening(false);
      setStatusTone('danger');
      setStatus(error instanceof Error ? error.message : 'Could not start listening.');
    }
  }, [deliver, listening, settings.voiceLanguage]);

  const providerLabel = providerId === 'claude' ? 'Claude' : 'Offline mode';

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.column}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View>
              <ThemedText type="subtitle" style={styles.title}>
                Assistant
              </ThemedText>
              <View style={styles.providerRow}>
                <View
                  style={[
                    styles.providerDot,
                    { backgroundColor: providerId === 'claude' ? theme.success : theme.textSecondary },
                  ]}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {providerLabel}
                </ThemedText>
              </View>
            </View>
            <IconButton
              ios="gearshape.fill"
              material="settings"
              label="Settings"
              onPress={() => router.push('/settings')}
            />
          </View>

          <KeyboardAvoidingView
            style={styles.body}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}>
            <FlatList
              ref={listRef}
              style={styles.list}
              data={messages}
              keyExtractor={(message) => message.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              contentContainerStyle={[
                styles.listContent,
                messages.length === 0 && styles.listContentEmpty,
              ]}
              ListEmptyComponent={
                <EmptyState
                  userName={settings.userName}
                  onPick={(suggestion) => void deliver(suggestion)}
                />
              }
              ListFooterComponent={isThinking ? <TypingIndicator /> : undefined}
              onContentSizeChange={() => {
                if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
              }}
              keyboardShouldPersistTaps="handled"
            />
            <SafeAreaView edges={['bottom']} style={styles.composerArea}>
              <Composer
                value={draft}
                onChangeText={setDraft}
                onSend={() => void deliver(draft)}
                onToggleMic={() => void toggleMic()}
                listening={listening}
                busy={isThinking}
                status={status}
                statusTone={statusTone}
              />
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function EmptyState({
  userName,
  onPick,
}: {
  userName: string;
  onPick: (suggestion: string) => void;
}) {
  const theme = useTheme();
  const greeting = userName.trim() ? `Hi ${userName.trim()}.` : 'Hi there.';

  return (
    <View style={styles.empty}>
      <ThemedText type="title" style={styles.emptyTitle}>
        {greeting}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        Type or tap the microphone. Try one of these:
      </ThemedText>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            onPress={() => onPick(suggestion)}
            style={({ pressed }) => [
              styles.suggestion,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}>
            <ThemedText type="small">{suggestion}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  column: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  providerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  body: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: Spacing.three,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  composerArea: {
    paddingBottom: Spacing.two,
  },
  empty: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 34,
    lineHeight: 40,
  },
  emptyText: {
    marginBottom: Spacing.two,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  suggestion: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
