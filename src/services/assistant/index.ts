/**
 * Picks the assistant provider for the current settings. Screens call
 * `resolveAssistant` and never construct a provider directly.
 */

import { ClaudeAssistant } from './claude-assistant';
import { LocalAssistant } from './local-assistant';
import type { AssistantProvider, AssistantProviderId } from './types';

export type ProviderPreference = 'auto' | AssistantProviderId;

const local = new LocalAssistant();
let cachedClaude: { key: string; provider: ClaudeAssistant } | null = null;

export function resolveAssistant(
  preference: ProviderPreference,
  claudeApiKey: string | null,
): AssistantProvider {
  const wantsClaude = preference === 'claude' || (preference === 'auto' && !!claudeApiKey);
  if (!wantsClaude || !claudeApiKey) return local;

  if (!cachedClaude || cachedClaude.key !== claudeApiKey) {
    cachedClaude = { key: claudeApiKey, provider: new ClaudeAssistant(claudeApiKey) };
  }
  return cachedClaude.provider;
}

export * from './types';
