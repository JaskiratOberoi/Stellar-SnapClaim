/**
 * Cloud assistant backed by the Claude API through the official SDK.
 *
 * Claude gets a small set of tools over the local store so it can add tasks,
 * set reminders, log expenses and answer questions about them. The API key is
 * the user's own and lives in the device's secure storage; requests go straight
 * from the device to Anthropic. `dangerouslyAllowBrowser` is required because
 * the web and desktop builds run in a browser-like environment.
 */

import Anthropic from '@anthropic-ai/sdk';

import { runCommand, summariseExpenses } from './actions';
import type {
  AssistantContext,
  AssistantProvider,
  AssistantReply,
  ChatMessage,
} from './types';

import { endOfDay, startOfDay, startOfMonth, endOfMonth, startOfWeek } from '@/services/format';
import type { Command } from '@/services/nlp/parse-command';
import { EXPENSE_CATEGORIES, type ExpenseCategory, type Priority } from '@/services/store/types';

export const CLAUDE_MODEL = 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 6;

const STABLE_SYSTEM_PROMPT = `You are a warm, capable personal assistant inside a cross-platform app on the user's phone or computer.
The app is the user's storehouse for tasks, reminders and expenses. Use the tools to add, complete, delete and list tasks, to set reminders, to log expenses and to summarise spending. When the user states something that belongs in the store, act with a tool rather than only acknowledging it. Ask a short question only when a required detail (such as an amount) is genuinely missing.
Be concise: answer in a few sentences unless the user asks for depth. Use plain language.
Your replies may be read aloud by text-to-speech, so prefer prose over tables and code unless asked.
When you do not know something that depends on live data (weather, news, prices), say so plainly instead of guessing.`;

const CATEGORY_IDS = EXPENSE_CATEGORIES.map((category) => category.id);

const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: 'add_task',
    description:
      'Add a task to the user\'s list. Set remind_at to make it a reminder that notifies the user. Dates are ISO 8601 in the user\'s local time.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short imperative title, e.g. "Call Ravi".' },
        notes: { type: ['string', 'null'] },
        due_at: { type: ['string', 'null'], description: 'ISO 8601 date or date-time the task is due, or null.' },
        remind_at: { type: ['string', 'null'], description: 'ISO 8601 date-time to notify the user, or null.' },
        priority: { type: ['string', 'null'], enum: ['low', 'normal', 'high', null] },
      },
      required: ['title', 'notes', 'due_at', 'remind_at', 'priority'],
      additionalProperties: false,
    },
  },
  {
    name: 'complete_task',
    description: 'Mark an open task as done. Match by title words.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Words from the task title.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a task or reminder entirely. Match by title words.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Words from the task title.' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tasks',
    description: 'List the user\'s tasks. scope: open (default), today, overdue, reminders (upcoming), done.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { scope: { type: 'string', enum: ['open', 'today', 'overdue', 'reminders', 'done'] } },
      required: ['scope'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_expense',
    description: 'Log money the user spent. Amount is a positive number in the given currency (null uses the user\'s default).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        currency: { type: ['string', 'null'], description: 'ISO 4217 code, or null for the default.' },
        note: { type: 'string', description: 'What it was for, e.g. "lunch with Ravi".' },
        category: { type: ['string', 'null'], enum: [...CATEGORY_IDS, null] },
        spent_at: { type: ['string', 'null'], description: 'ISO 8601 date the money was spent, or null for now.' },
      },
      required: ['amount', 'currency', 'note', 'category', 'spent_at'],
      additionalProperties: false,
    },
  },
  {
    name: 'expense_summary',
    description: 'Total and top categories for a period.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { period: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'this_month', 'last_month'] } },
      required: ['period'],
      additionalProperties: false,
    },
  },
];

function describeNow(context: AssistantContext): string {
  const now = new Intl.DateTimeFormat(context.locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: context.timeZone,
  }).format(new Date());
  const name = context.userName ? `The user likes to be called ${context.userName}. ` : '';
  const currency = context.store ? `Their default currency is ${context.store.defaultCurrency}. ` : '';
  return `${name}${currency}The current date and time is ${now} (${context.timeZone}).`;
}

function parseIso(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function commandFromTool(name: string, input: Record<string, unknown>): Command | null {
  switch (name) {
    case 'add_task': {
      const priority = (input.priority as Priority | null) ?? 'normal';
      return {
        kind: 'add_task',
        title: String(input.title ?? '').trim(),
        notes: typeof input.notes === 'string' && input.notes ? input.notes : undefined,
        dueAt: parseIso(input.due_at),
        remindAt: parseIso(input.remind_at),
        priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
      };
    }
    case 'complete_task':
      return { kind: 'complete_task', query: String(input.query ?? '') };
    case 'delete_task':
      return { kind: 'delete_task', query: String(input.query ?? '') };
    case 'list_tasks': {
      const scope = String(input.scope ?? 'open');
      return {
        kind: 'list_tasks',
        scope: (['open', 'today', 'overdue', 'reminders', 'done'] as const).find((item) => item === scope) ?? 'open',
      };
    }
    case 'add_expense': {
      const category = input.category as ExpenseCategory | null;
      return {
        kind: 'add_expense',
        amount: Number(input.amount),
        currency: typeof input.currency === 'string' && /^[A-Z]{3}$/.test(input.currency) ? input.currency : undefined,
        note: String(input.note ?? '').trim(),
        category: category && CATEGORY_IDS.includes(category) ? category : 'other',
        spentAt: parseIso(input.spent_at),
      };
    }
    case 'expense_summary': {
      const now = Date.now();
      const periods = {
        today: { label: 'today', from: startOfDay(now), to: endOfDay(now) },
        yesterday: { label: 'yesterday', from: startOfDay(now - 86400000), to: endOfDay(now - 86400000) },
        this_week: { label: 'this week', from: startOfWeek(now), to: endOfDay(now) },
        this_month: { label: 'this month', from: startOfMonth(now), to: endOfMonth(now) },
        last_month: (() => {
          const date = new Date(now);
          date.setMonth(date.getMonth() - 1, 1);
          return { label: 'last month', from: startOfMonth(date.getTime()), to: endOfMonth(date.getTime()) };
        })(),
      } as const;
      const key = String(input.period) as keyof typeof periods;
      return { kind: 'expense_summary', period: periods[key] ?? periods.this_month };
    }
    default:
      return null;
  }
}

export class ClaudeAssistant implements AssistantProvider {
  readonly id = 'claude' as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async reply(history: ChatMessage[], context: AssistantContext): Promise<AssistantReply> {
    const messages: Anthropic.Beta.BetaMessageParam[] = history
      .filter((message) => !message.error && message.text.trim().length > 0)
      .map((message) => ({ role: message.role, content: message.text }));

    const store = context.store;
    const tools = store ? TOOLS : [];

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
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
          tools,
          messages,
        });

        if (response.stop_reason === 'refusal') {
          return { text: "I can't help with that request.", provider: this.id };
        }

        const toolUses = response.content.filter(
          (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use',
        );

        if (response.stop_reason !== 'tool_use' || toolUses.length === 0 || !store) {
          const text = response.content
            .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
            .map((block) => block.text)
            .join('\n')
            .trim();
          return { text: text || 'Done.', provider: this.id };
        }

        // Run every requested tool, then return all results in one user turn.
        messages.push({ role: 'assistant', content: response.content });
        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
          const command = commandFromTool(toolUse.name, (toolUse.input ?? {}) as Record<string, unknown>);
          if (!command) {
            results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: `Unknown tool ${toolUse.name}`, is_error: true });
            continue;
          }
          try {
            const outcome =
              command.kind === 'expense_summary'
                ? { text: summariseExpenses(store.expenses, command.period, store.defaultCurrency, context.locale) }
                : await runCommand(command, { store, locale: context.locale });
            results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: outcome.text });
          } catch (error) {
            results.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: error instanceof Error ? error.message : 'The action failed.',
              is_error: true,
            });
          }
        }
        messages.push({ role: 'user', content: results });
      }
      return { text: 'I did several things but ran out of steps; check your tasks and expenses.', provider: this.id };
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
