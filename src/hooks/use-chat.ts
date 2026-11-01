import { useCallback, useEffect, useRef, useState } from 'react';

import { useSettings } from '@/hooks/use-settings';
import { useStore } from '@/hooks/use-store';
import {
  newId,
  resolveAssistant,
  type AssistantContext,
  type ChatMessage,
  type Conversation,
} from '@/services/assistant';
import { runCommand } from '@/services/assistant/actions';
import { parseCommand } from '@/services/nlp/parse-command';
import {
  DEFAULT_CONVERSATION_ID,
  deleteConversation,
  loadConversation,
  saveConversation,
} from '@/services/storage/conversation-store';

function emptyConversation(): Conversation {
  const now = Date.now();
  return { id: DEFAULT_CONVERSATION_ID, messages: [], createdAt: now, updatedAt: now };
}

export function currentLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
}

function currentContext(userName: string): AssistantContext {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  return {
    userName: userName.trim() || undefined,
    timeZone: resolved.timeZone || 'UTC',
    locale: resolved.locale || 'en-US',
  };
}

export function useChat() {
  const { settings, claudeApiKey } = useSettings();
  const store = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const conversation = useRef<Conversation>(emptyConversation());

  useEffect(() => {
    let cancelled = false;
    loadConversation().then((stored) => {
      if (cancelled) return;
      if (stored) {
        conversation.current = stored;
        setMessages(stored.messages);
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((next: ChatMessage[]) => {
    conversation.current = { ...conversation.current, messages: next, updatedAt: Date.now() };
    setMessages(next);
    void saveConversation(conversation.current);
  }, []);

  const assistant = resolveAssistant(settings.provider, claudeApiKey);

  /**
   * Send a user message. Store commands ("remind me…", "spent 250 on…") are
   * handled locally first; anything else goes to the configured assistant.
   */
  const send = useCallback(
    async (text: string): Promise<ChatMessage | null> => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return null;

      const userMessage: ChatMessage = {
        id: newId(),
        role: 'user',
        text: trimmed,
        createdAt: Date.now(),
      };
      const history = [...conversation.current.messages, userMessage];
      commit(history);
      setIsThinking(true);

      let reply: ChatMessage;
      try {
        const command = parseCommand(trimmed);
        if (command) {
          const result = await runCommand(command, { store, locale: currentLocale() });
          reply = {
            id: newId(),
            role: 'assistant',
            text: result.text,
            createdAt: Date.now(),
            provider: 'local',
          };
        } else {
          const context = { ...currentContext(settings.userName), store };
          const answer = await assistant.reply(history, context);
          reply = {
            id: newId(),
            role: 'assistant',
            text: answer.text,
            createdAt: Date.now(),
            provider: answer.provider,
          };
        }
      } catch (error) {
        reply = {
          id: newId(),
          role: 'assistant',
          text: error instanceof Error ? error.message : 'Something went wrong.',
          createdAt: Date.now(),
          provider: assistant.id,
          error: true,
        };
      } finally {
        setIsThinking(false);
      }

      commit([...conversation.current.messages, reply]);
      return reply;
    },
    [assistant, commit, isThinking, settings.userName, store],
  );

  const clear = useCallback(async () => {
    conversation.current = emptyConversation();
    setMessages([]);
    await deleteConversation();
  }, []);

  return { messages, loaded, isThinking, send, clear, providerId: assistant.id };
}
