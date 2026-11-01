/**
 * Offline, rule-based assistant. It never leaves the device, needs no key,
 * and is the fallback whenever the cloud provider is not configured.
 */

import type {
  AssistantContext,
  AssistantProvider,
  AssistantReply,
  ChatMessage,
} from './types';

type Rule = {
  test: RegExp;
  answer: (match: RegExpMatchArray, context: AssistantContext) => string;
};

function formatTime(context: AssistantContext): string {
  return new Intl.DateTimeFormat(context.locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: context.timeZone,
  }).format(new Date());
}

function formatDate(context: AssistantContext): string {
  return new Intl.DateTimeFormat(context.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: context.timeZone,
  }).format(new Date());
}

function greetingFor(context: AssistantContext): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: context.timeZone,
    }).format(new Date()),
  );
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const name = context.userName ? `, ${context.userName}` : '';
  return `Good ${part}${name}! How can I help?`;
}

/** Evaluate a small arithmetic expression safely (digits and + - * / ( ) . only). */
export function evaluateArithmetic(expression: string): number | null {
  const cleaned = expression
    .replace(/\s+/g, '')
    .replace(/x|×/g, '*')
    .replace(/÷/g, '/');
  if (!/^[\d+\-*/().]+$/.test(cleaned)) return null;
  const tokens = cleaned.match(/\d+(\.\d+)?|[+\-*/()]/g);
  if (!tokens) return null;

  let index = 0;
  const peek = () => tokens[index];
  const next = () => tokens[index++];

  const parsePrimary = (): number => {
    const token = next();
    if (token === '(') {
      const value = parseExpression();
      if (next() !== ')') throw new Error('unbalanced');
      return value;
    }
    if (token === '-') return -parsePrimary();
    if (token === undefined || !/^\d/.test(token)) throw new Error('unexpected');
    return Number(token);
  };
  const parseTerm = (): number => {
    let value = parsePrimary();
    while (peek() === '*' || peek() === '/') {
      const op = next();
      const rhs = parsePrimary();
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  };
  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  };

  try {
    const result = parseExpression();
    if (index !== tokens.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

const rules: Rule[] = [
  {
    test: /^(hi|hello|hey|good (morning|afternoon|evening))\b/i,
    answer: (_match, context) => greetingFor(context),
  },
  {
    test: /\b(what('s| is) the )?time\b/i,
    answer: (_match, context) => `It is ${formatTime(context)}.`,
  },
  {
    test: /\b(what('s| is) (the |today's )?date|what day is it|today)\b/i,
    answer: (_match, context) => `Today is ${formatDate(context)}.`,
  },
  {
    test: /\b(who are you|what are you|your name)\b/i,
    answer: () =>
      'I am your personal assistant. Offline I can answer quick questions, do arithmetic, and tell you the time and date. Add a Claude API key in Settings and I can do much more.',
  },
  {
    test: /\b(thank(s| you))\b/i,
    answer: () => 'You are welcome!',
  },
  {
    test: /(?:what(?:'s| is)\s+)?([\d\s+\-*/().x×÷]+)\s*[=?]?\s*$/i,
    answer: (match) => {
      const result = evaluateArithmetic(match[1]);
      return result === null
        ? "I couldn't work that one out."
        : `${match[1].trim()} = ${Number(result.toFixed(6))}`;
    },
  },
];

export class LocalAssistant implements AssistantProvider {
  readonly id = 'local' as const;

  async reply(history: ChatMessage[], context: AssistantContext): Promise<AssistantReply> {
    const last = [...history].reverse().find((message) => message.role === 'user');
    const text = last?.text.trim() ?? '';

    for (const rule of rules) {
      const match = text.match(rule.test);
      if (match) {
        return { text: rule.answer(match, context), provider: this.id };
      }
    }

    return {
      text: "I'm in offline mode, so I can only handle simple things like the time, the date and arithmetic. Add a Claude API key in Settings to unlock full conversations.",
      provider: this.id,
    };
  }
}
