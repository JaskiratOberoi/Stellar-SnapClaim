/**
 * Shared contracts for the assistant "brain". Screens only ever talk to an
 * `AssistantProvider`; which implementation sits behind it is a settings choice.
 */

export type MessageRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** Which provider answered. Only set on assistant messages. */
  provider?: AssistantProviderId;
  /** Set when the provider failed to answer this turn. */
  error?: boolean;
};

export type Conversation = {
  id: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
};

export type AssistantContext = {
  /** What the user asked to be called. */
  userName?: string;
  /** IANA time zone, used for date/time answers. */
  timeZone: string;
  /** BCP 47 locale, used for formatting. */
  locale: string;
};

export type AssistantReply = {
  text: string;
  /** Provider that produced the reply, for the UI badge and for debugging. */
  provider: AssistantProviderId;
};

export type AssistantProviderId = 'local' | 'claude';

export interface AssistantProvider {
  readonly id: AssistantProviderId;
  /**
   * Produce the next assistant turn. `history` is every prior message in the
   * conversation, oldest first, and already includes the newest user message.
   */
  reply(history: ChatMessage[], context: AssistantContext): Promise<AssistantReply>;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
