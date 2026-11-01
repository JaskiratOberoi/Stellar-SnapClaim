/**
 * Executes parsed commands against the store and phrases the outcome.
 * Shared by the quick-add bar, the offline assistant and Claude's tools, so
 * every entry point behaves the same way.
 */

import type { StoreApi } from '@/hooks/use-store';
import { endOfDay, formatMoney, formatWhen, pluralise, startOfDay } from '@/services/format';
import type { Command, Period } from '@/services/nlp/parse-command';
import { categoryInfo, type Expense, type Task } from '@/services/store/types';

export type ActionResult = {
  /** Spoken / displayed reply. */
  text: string;
  /** True when the store changed, so callers can refresh or navigate. */
  changed: boolean;
  /** Screen the UI may jump to after the action. */
  goTo?: 'tasks' | 'expenses';
};

export type ActionContext = {
  store: StoreApi;
  locale: string;
};

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Find the open task whose title best matches a free-text query. */
export function findTask(tasks: Task[], query: string, includeDone = false): Task | null {
  const needle = normalise(query);
  if (!needle) return null;
  const candidates = tasks.filter((task) => includeDone || !task.done);

  const exact = candidates.find((task) => normalise(task.title) === needle);
  if (exact) return exact;

  const contains = candidates.find(
    (task) => normalise(task.title).includes(needle) || needle.includes(normalise(task.title)),
  );
  if (contains) return contains;

  const words = needle.split(' ').filter((word) => word.length > 2);
  let best: { task: Task; score: number } | null = null;
  for (const task of candidates) {
    const title = normalise(task.title);
    const score = words.filter((word) => title.includes(word)).length;
    if (score > 0 && (!best || score > best.score)) best = { task, score };
  }
  return best?.task ?? null;
}

export function describeTask(task: Task, locale: string): string {
  const when = task.remindAt ?? task.dueAt;
  const suffix = when ? ` (${formatWhen(when, locale)})` : '';
  const flag = task.priority === 'high' ? ' !' : '';
  return `${task.title}${suffix}${flag}`;
}

export function tasksInScope(
  tasks: Task[],
  scope: 'open' | 'today' | 'overdue' | 'reminders' | 'done',
  now = Date.now(),
): Task[] {
  switch (scope) {
    case 'open':
      return tasks.filter((task) => !task.done);
    case 'done':
      return tasks.filter((task) => task.done);
    case 'today':
      return tasks.filter((task) => {
        if (task.done) return false;
        const when = task.dueAt ?? task.remindAt;
        return when !== undefined && when >= startOfDay(now) && when <= endOfDay(now);
      });
    case 'overdue':
      return tasks.filter((task) => {
        if (task.done) return false;
        const when = task.dueAt ?? task.remindAt;
        return when !== undefined && when < startOfDay(now);
      });
    case 'reminders':
      return tasks.filter((task) => !task.done && task.remindAt !== undefined && task.remindAt >= now);
  }
}

export function expensesInPeriod(expenses: Expense[], period: Period): Expense[] {
  return expenses.filter((expense) => expense.spentAt >= period.from && expense.spentAt <= period.to);
}

export function summariseExpenses(expenses: Expense[], period: Period, currency: string, locale: string): string {
  const inPeriod = expensesInPeriod(expenses, period);
  if (inPeriod.length === 0) return `You have no expenses recorded ${period.label}.`;

  const byCurrency = new Map<string, number>();
  const byCategory = new Map<string, number>();
  for (const expense of inPeriod) {
    byCurrency.set(expense.currency, (byCurrency.get(expense.currency) ?? 0) + expense.amount);
    if (expense.currency === currency) {
      byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
    }
  }

  const totals = [...byCurrency.entries()]
    .map(([code, amount]) => formatMoney(amount, code, locale))
    .join(' + ');
  const top = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => `${categoryInfo(category as Expense['category']).label} ${formatMoney(amount, currency, locale)}`)
    .join(', ');

  return `You spent ${totals} ${period.label} across ${pluralise(inPeriod.length, 'expense')}.${top ? ` Biggest: ${top}.` : ''}`;
}

export async function runCommand(command: Command, context: ActionContext): Promise<ActionResult> {
  const { store, locale } = context;

  switch (command.kind) {
    case 'add_task': {
      const task = await store.addTask({
        title: command.title,
        dueAt: command.dueAt,
        remindAt: command.remindAt,
        priority: command.priority,
        notes: command.notes,
      });
      if (task.remindAt) {
        return {
          text: `Reminder set: "${task.title}" ${formatWhen(task.remindAt, locale)}.`,
          changed: true,
          goTo: 'tasks',
        };
      }
      const due = task.dueAt ? `, due ${formatWhen(task.dueAt, locale)}` : '';
      return { text: `Added "${task.title}" to your tasks${due}.`, changed: true, goTo: 'tasks' };
    }

    case 'add_expense': {
      const expense = await store.addExpense({
        amount: command.amount,
        currency: command.currency,
        category: command.category,
        note: command.note,
        spentAt: command.spentAt,
      });
      const label = categoryInfo(expense.category).label;
      const note = expense.note ? ` for ${expense.note}` : '';
      const when = expense.spentAt && !isToday(expense.spentAt) ? ` on ${formatWhen(expense.spentAt, locale)}` : '';
      return {
        text: `Logged ${formatMoney(expense.amount, expense.currency, locale)}${note}${when} under ${label}.`,
        changed: true,
        goTo: 'expenses',
      };
    }

    case 'complete_task': {
      const task = findTask(store.tasks, command.query);
      if (!task) return { text: `I couldn't find an open task matching "${command.query}".`, changed: false };
      await store.updateTask(task.id, { done: true });
      return { text: `Done: "${task.title}".`, changed: true };
    }

    case 'delete_task': {
      const task = findTask(store.tasks, command.query, true);
      if (!task) return { text: `I couldn't find a task matching "${command.query}".`, changed: false };
      await store.deleteTask(task.id);
      return { text: `Deleted "${task.title}".`, changed: true };
    }

    case 'list_tasks': {
      const tasks = tasksInScope(store.tasks, command.scope);
      const noun = command.scope === 'reminders' ? 'reminders' : 'tasks';
      if (tasks.length === 0) {
        const qualifier = { open: 'open', today: 'for today', overdue: 'overdue', reminders: 'upcoming', done: 'completed' }[command.scope];
        return { text: `You have no ${qualifier} ${noun}.`, changed: false, goTo: 'tasks' };
      }
      const lines = tasks.slice(0, 8).map((task) => `• ${describeTask(task, locale)}`);
      const more = tasks.length > 8 ? `\n…and ${tasks.length - 8} more.` : '';
      return { text: `${pluralise(tasks.length, noun.slice(0, -1))}:\n${lines.join('\n')}${more}`, changed: false, goTo: 'tasks' };
    }

    case 'expense_summary':
      return {
        text: summariseExpenses(store.expenses, command.period, store.defaultCurrency, locale),
        changed: false,
        goTo: 'expenses',
      };
  }
}

function isToday(timestamp: number): boolean {
  const now = Date.now();
  return timestamp >= startOfDay(now) && timestamp <= endOfDay(now);
}
