/**
 * Persistence for the chat transcript. One conversation for now; the shape
 * already carries an id so more can be added without a migration.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Conversation } from '@/services/assistant';

const KEY_PREFIX = 'assistant.conversation.';
export const DEFAULT_CONVERSATION_ID = 'default';

export async function loadConversation(
  id: string = DEFAULT_CONVERSATION_ID,
): Promise<Conversation | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as Conversation) : null;
  } catch {
    return null;
  }
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + conversation.id, JSON.stringify(conversation));
}

export async function deleteConversation(id: string = DEFAULT_CONVERSATION_ID): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFIX + id);
}
