/**
 * Cloud assistant backed by the Claude API through the official SDK.
 *
 * The API key is the user's own and lives in the device's secure storage; the
 * request goes straight from the device to Anthropic, so there is no server
 * in between. `dangerouslyAllowBrowser` is required because the web and
 * desktop builds run in a browser-like environment.
 */

import Anthropic from '@anthropic-ai/sdk';

import type {
  AssistantContext,
  AssistantProvider,
  AssistantReply,
  ChatMessage,
} from './types';

export const CLAUDE_MODEL = 'claude-opus-5-5';

const STABLE_SYSTEM_PROMPT = `You are a warm, capable personal assistant inside a cross-platform app on the user's phone or computer.
Be concise: answer in a few sentences unless the user asks for depth. Use plain language.
Your replies may be read aloud by text-to-speech, so prefer prose over tables and code unless asked.
When you do not know something that depends on live data (weather, news, prices), say so plainly instead of guessing.`;

function describeNow(context: AssistantContext): string {
  const now = new Intl.DateTimeFormat(context.locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: context.timeZone,
  }).format(new Date());
  const name = context.userName ? `The user likes to be called ${context.userName}. ` : '';
  return `${name}The current date and time is ${now} (${context.timeZone}).`;
}

export class ClaudeAssistant implements AssistantProvider {
  readonly id = 'claude' as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async reply(history: ChatMessage[], context: AssistantContext): Promise<AssistantReply> {
    const messages: Anthropic.MessageParam[] = history
      .filter((message) => !message.error && message.text.trim().length > 0)
      .map((message) => ({ role: message.role, content: message.text }));

    try {
      const response = await this.client.beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [
          { type: 'text', text: STABLE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: describeNow(context) },
        ],
        messages,
      });

      if (response.stop_reason === 'refusal') {
        return {
          text: "I can't help with that request.",
          provider: this.id,
        };
      }

      const text = response.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      return { text: text || 'I did not have anything to add.', provider: this.id };
    } catch (error) {
      throw new Error(describeError(error));
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'The Claude API key was rejected. Check it in Settings.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Claude is rate limited right now. Try again in a moment.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach Claude. Check your internet connection.';
  }
  if (error instanceof Anthropic.APIError) {
    return `Claude returned an error (${error.status ?? 'unknown'}): ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong talking to Claude.';
}
