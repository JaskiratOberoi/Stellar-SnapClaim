/**
 * Turns a sentence like "remind me to call Ravi tomorrow at 5pm" or
 * "spent 250 on lunch" into a structured command. Used by the quick-add bar,
 * the offline assistant, and as a fast path before asking Claude.
 */

import * as chrono from 'chrono-node';

import { endOfDay, endOfMonth, startOfDay, startOfMonth, startOfWeek } from '@/services/format';
import { guessCategory, type ExpenseCategory, type Priority } from '@/services/store/types';

export type Period = { label: string; from: number; to: number };

export type Command =
  | { kind: 'add_task'; title: string; dueAt?: number; remindAt?: number; priority: Priority; notes?: string }
  | { kind: 'add_expense'; amount: number; currency?: string; category: ExpenseCategory; note: string; spentAt?: number }
  | { kind: 'complete_task'; query: string }
  | { kind: 'delete_task'; query: string }
  | { kind: 'list_tasks'; scope: 'open' | 'today' | 'overdue' | 'reminders' | 'done' }
  | { kind: 'expense_summary'; period: Period };

const CURRENCY_SYMBOLS: Record<string, string> = {
  '₹': 'INR',
  rs: 'INR',
  'rs.': 'INR',
  inr: 'INR',
  rupees: 'INR',
  $: 'USD',
  usd: 'USD',
  dollars: 'USD',
  '€': 'EUR',
  eur: 'EUR',
  '£': 'GBP',
  gbp: 'GBP',
};

const AMOUNT_PATTERN = /(₹|\$|€|£|rs\.?|inr|usd|eur|gbp)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|rupees|rs\.?|inr|dollars|usd|eur|gbp)?/i;
const ORDINAL_DAY_PATTERN = /\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+of\s+(\w+))?/i;

function cleanTitle(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^(to|that|about)\s+/i, '')
    .replace(/[\s,.!]+$/g, '')
    .trim();
}

/** Parse a date phrase out of `text`; returns the timestamp and the text with the phrase removed. */
function extractDate(text: string, reference: Date): { when?: number; rest: string; hasTime: boolean } {
  const results = chrono.parse(text, reference, { forwardDate: true });
  const match = results[0];
  if (!match) {
    // chrono skips bare ordinals such as "on the 5th"; treat them as the next such day of month.
    const ordinal = text.match(ORDINAL_DAY_PATTERN);
    if (!ordinal) return { rest: text, hasTime: false };
    const day = Number(ordinal[1]);
    if (day < 1 || day > 31) return { rest: text, hasTime: false };
    const date = new Date(reference);
    date.setHours(0, 0, 0, 0);
    date.setDate(day);
    if (date.getTime() < reference.getTime() - 24 * 60 * 60 * 1000) date.setMonth(date.getMonth() + 1, day);
    const rest = `${text.slice(0, ordinal.index)} ${text.slice((ordinal.index ?? 0) + ordinal[0].length)}`
      .replace(/\s+(at|on|by|in|for)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { when: date.getTime(), rest, hasTime: false };
  }

  const hasTime = match.start.isCertain('hour');
  const date = match.start.date();
  if (!hasTime) date.setHours(0, 0, 0, 0);

  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match.text.length);
  const rest = `${before} ${after}`.replace(/\s+(at|on|by|in|for)\s*$/i, '').replace(/\s+/g, ' ').trim();
  return { when: date.getTime(), rest, hasTime };
}

function periodFor(text: string, reference: Date): Period {
  const now = reference.getTime();
  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) return { label: 'today', from: startOfDay(now), to: endOfDay(now) };
  if (/\byesterday\b/.test(lower)) {
    const yesterday = now - 24 * 60 * 60 * 1000;
    return { label: 'yesterday', from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }
  if (/\bthis week\b/.test(lower)) return { label: 'this week', from: startOfWeek(now), to: endOfDay(now) };
  if (/\blast month\b/.test(lower)) {
    const lastMonth = new Date(reference);
    lastMonth.setMonth(lastMonth.getMonth() - 1, 1);
    return { label: 'last month', from: startOfMonth(lastMonth.getTime()), to: endOfMonth(lastMonth.getTime()) };
  }
  return { label: 'this month', from: startOfMonth(now), to: endOfMonth(now) };
}

function parseAmount(text: string): { amount: number; currency?: string; rest: string } | null {
  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;
  let amount = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const prefix = match[1]?.toLowerCase();
  const suffix = match[3]?.toLowerCase();
  if (suffix === 'k') amount *= 1000;
  const currency = CURRENCY_SYMBOLS[prefix ?? ''] ?? CURRENCY_SYMBOLS[suffix ?? ''];
  const rest = `${text.slice(0, match.index)} ${text.slice((match.index ?? 0) + match[0].length)}`;
  return { amount, currency, rest };
}

function priorityFrom(text: string): { priority: Priority; rest: string } {
  if (/\b(urgent|important|high priority|asap)\b/i.test(text)) {
    return { priority: 'high', rest: text.replace(/\b(urgent|important|high priority|asap)\b/gi, '') };
  }
  if (/\b(low priority|someday|whenever)\b/i.test(text)) {
    return { priority: 'low', rest: text.replace(/\b(low priority|someday|whenever)\b/gi, '') };
  }
  return { priority: 'normal', rest: text };
}

export function parseCommand(input: string, reference: Date = new Date()): Command | null {
  const text = input.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  // Listing and summaries first, so "show my expenses this month" never becomes an expense.
  if (/^(show|list|what('s| is| are)|view|open)\b.*\b(expenses?|spend(ing)?|spent)\b/.test(lower) ||
      /\bhow much (have i|did i|do i) (spent|spend)\b/.test(lower) ||
      /\bwhat (did|have) i (spend|spent)\b/.test(lower) ||
      /\b(my )?(total )?(spend|spending|expenses?) (today|yesterday|this week|this month|last month)\b/.test(lower) ||
      /^(expenses?|spending)( (today|yesterday|this week|this month|last month))?\??$/.test(lower)) {
    return { kind: 'expense_summary', period: periodFor(lower, reference) };
  }

  if (/^(show|list|what('s| is| are)|view|open)\b.*\b(reminders?)\b/.test(lower)) {
    return { kind: 'list_tasks', scope: 'reminders' };
  }
  if (/^(show|list|what('s| is| are)|view|open)\b.*\b(overdue)\b/.test(lower)) {
    return { kind: 'list_tasks', scope: 'overdue' };
  }
  if (/^(show|list|what('s| is| are)|view|open)\b.*\b(done|completed|finished)\b/.test(lower)) {
    return { kind: 'list_tasks', scope: 'done' };
  }
  if (/^(show|list|what('s| is| are)|view|open)\b.*\b(today|due today|for today|on my plate)\b/.test(lower) ||
      /^what('s| is) (on )?(for )?today\??$/.test(lower)) {
    return { kind: 'list_tasks', scope: 'today' };
  }
  if (/^(show|list|what('s| is| are)|view|open)\b.*\b(tasks?|todos?|to-dos?|to dos?)\b/.test(lower) ||
      /^(my )?(tasks|todos|to-dos)\??$/.test(lower)) {
    return { kind: 'list_tasks', scope: 'open' };
  }

  // Completing and deleting.
  const complete = text.match(/^(done|did|finished|completed?|tick|check off|mark done|mark)\s*(?:with\s+|the\s+)?(.+?)(?:\s+(?:as\s+)?done)?$/i);
  if (complete && !/^done\s*$/i.test(text)) {
    return { kind: 'complete_task', query: cleanTitle(complete[2]) };
  }
  const remove = text.match(/^(delete|remove|cancel|drop)\s+(?:the\s+)?(?:task|reminder|todo)?\s*(.+)$/i);
  if (remove) {
    return { kind: 'delete_task', query: cleanTitle(remove[2]) };
  }

  // Expenses: "spent 250 on lunch", "paid 1200 for electricity", "₹80 chai", "lunch 250".
  const expenseVerb = text.match(/^(?:i\s+)?(spent|paid|bought|expense|spend|purchased|add expense|log expense|cost)\b[:\s]*(.+)$/i);
  if (expenseVerb) {
    const parsed = parseAmount(expenseVerb[2]);
    if (parsed) {
      const { when, rest } = extractDate(parsed.rest, reference);
      const note = cleanTitle(rest.replace(/^\s*(on|for|at|to)\s+/i, ''));
      return {
        kind: 'add_expense',
        amount: parsed.amount,
        currency: parsed.currency,
        category: guessCategory(note),
        note,
        spentAt: when,
      };
    }
  }
  const leadingAmount = text.match(/^(₹|\$|€|£|rs\.?\s*)?\d/i);
  if (leadingAmount) {
    const parsed = parseAmount(text);
    if (parsed && cleanTitle(parsed.rest).length > 0) {
      const { when, rest } = extractDate(parsed.rest, reference);
      const note = cleanTitle(rest.replace(/^\s*(on|for|at|to)\s+/i, ''));
      return {
        kind: 'add_expense',
        amount: parsed.amount,
        currency: parsed.currency,
        category: guessCategory(note),
        note,
        spentAt: when,
      };
    }
  }

  // Reminders: "remind me to call Ravi tomorrow at 5pm", "reminder: pay rent on the 1st".
  const remind = text.match(/^(?:please\s+)?(?:remind me|reminder|set (?:a )?reminder)\b[:\s]*(?:to\s+)?(.+)$/i);
  if (remind) {
    const { priority, rest: afterPriority } = priorityFrom(remind[1]);
    const { when, rest, hasTime } = extractDate(afterPriority, reference);
    const title = cleanTitle(rest);
    if (!title) return null;
    let remindAt = when;
    if (remindAt !== undefined && !hasTime) {
      remindAt = startOfDay(remindAt) + 9 * 60 * 60 * 1000; // date only: remind at 9 am
    }
    return { kind: 'add_task', title, dueAt: when, remindAt, priority };
  }

  // Tasks: "add task buy milk", "todo: book dentist", "task buy milk tomorrow", "add buy milk to my list".
  const task = text.match(/^(?:please\s+)?(?:add|new|create|make|note)?\s*(?:a\s+)?(?:task|todo|to-do|to do)s?\b[:\s]*(.+)$/i)
    ?? text.match(/^(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:my\s+)?(?:list|tasks|todos?)$/i)
    ?? text.match(/^(?:i need to|i have to|i should|need to|have to|must)\s+(.+)$/i);
  if (task) {
    const { priority, rest: afterPriority } = priorityFrom(task[1]);
    const { when, rest } = extractDate(afterPriority, reference);
    const title = cleanTitle(rest);
    if (!title) return null;
    return { kind: 'add_task', title, dueAt: when, priority };
  }

  return null;
}
