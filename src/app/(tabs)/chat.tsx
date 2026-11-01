import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Composer } from '@/components/chat/composer';
import { MessageBubble } from '@/components/chat/message-bubble';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { Screen, SettingsAction } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
  'Remind me to call Ravi tomorrow at 5pm',
  'Spent 250 on lunch',
  'Show my tasks',
  'What did I spend this month?',
];

export default function ChatScreen() {
  const { settings } = useSettings();
  const { messages, isThinking, loaded, send, providerId } = useChat();
  const { q } = useLocalSearchParams<{ q?: string }>();

  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'neutral' | 'danger'>('neutral');
  const stopListeners = useRef<(() => void) | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const handledQuery = useRef<string | null>(null);

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

  // A sentence handed over from a quick-add bar elsewhere in the app.
  useEffect(() => {
    if (!q || !loaded || handledQuery.current === q) return;
    handledQuery.current = q;
    router.setParams({ q: undefined });
    void deliver(q);
  }, [q, loaded, deliver]);

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

  const providerLabel = providerId === 'claude' ? 'Claude + your store' : 'Offline · your store';

  return (
    <Screen title="Assistant" subtitle={providerLabel} action={<SettingsAction onPress={() => router.push('/settings')} />}>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={[styles.listContent, messages.length === 0 && styles.listContentEmpty]}
          ListEmptyComponent={<EmptyState userName={settings.userName} onPick={(suggestion) => void deliver(suggestion)} />}
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
    </Screen>
  );
}

function EmptyState({ userName, onPick }: { userName: string; onPick: (suggestion: string) => void }) {
  const theme = useTheme();
  const greeting = userName.trim() ? `Hi ${userName.trim()}.` : 'Hi there.';

  return (
    <View style={styles.empty}>
      <ThemedText type="title" style={styles.emptyTitle}>
        {greeting}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyText}>
        Tell me what to remember, remind you of, or track. Type or tap the microphone.
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
