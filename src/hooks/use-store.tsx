import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { newId } from '@/services/assistant/types';
import { cancelReminder, scheduleReminder } from '@/services/reminders/notifications';
import {
  clearStore,
  loadExpenses,
  loadTasks,
  saveExpenses,
  saveTasks,
} from '@/services/store/repository';
import {
  guessCategory,
  type Expense,
  type ExpenseInput,
  type Task,
  type TaskInput,
} from '@/services/store/types';

export type StoreApi = {
  ready: boolean;
  tasks: Task[];
  expenses: Expense[];
  defaultCurrency: string;

  addTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: string, patch: Partial<TaskInput> & { done?: boolean }) => Promise<Task | null>;
  toggleTask: (id: string) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<void>;

  addExpense: (input: ExpenseInput) => Promise<Expense>;
  updateExpense: (id: string, patch: Partial<ExpenseInput>) => Promise<Expense | null>;
  deleteExpense: (id: string) => Promise<void>;

  clearEverything: () => Promise<void>;
};

const StoreContext = createContext<StoreApi | null>(null);

type Props = {
  children: ReactNode;
  /** ISO 4217 code applied to expenses that do not name a currency. */
  defaultCurrency: string;
};

function sortTasks(tasks: Task[]): Task[] {
  const rank = { high: 0, normal: 1, low: 2 } as const;
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const aWhen = a.remindAt ?? a.dueAt ?? Number.MAX_SAFE_INTEGER;
    const bWhen = b.remindAt ?? b.dueAt ?? Number.MAX_SAFE_INTEGER;
    if (aWhen !== bWhen) return aWhen - bWhen;
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
    return b.createdAt - a.createdAt;
  });
}

function sortExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => b.spentAt - a.spentAt || b.createdAt - a.createdAt);
}

export function StoreProvider({ children, defaultCurrency }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const tasksRef = useRef<Task[]>([]);
  const expensesRef = useRef<Expense[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTasks(), loadExpenses()]).then(([storedTasks, storedExpenses]) => {
      if (cancelled) return;
      tasksRef.current = sortTasks(storedTasks);
      expensesRef.current = sortExpenses(storedExpenses);
      setTasks(tasksRef.current);
      setExpenses(expensesRef.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const commitTasks = useCallback((next: Task[]) => {
    tasksRef.current = sortTasks(next);
    setTasks(tasksRef.current);
    void saveTasks(tasksRef.current);
  }, []);

  const commitExpenses = useCallback((next: Expense[]) => {
    expensesRef.current = sortExpenses(next);
    setExpenses(expensesRef.current);
    void saveExpenses(expensesRef.current);
  }, []);

  const addTask = useCallback(
    async (input: TaskInput): Promise<Task> => {
      const task: Task = {
        id: newId(),
        title: input.title.trim(),
        notes: input.notes?.trim() || undefined,
        dueAt: input.dueAt,
        remindAt: input.remindAt,
        priority: input.priority ?? 'normal',
        done: false,
        createdAt: Date.now(),
      };
      const notificationId = await scheduleReminder(task);
      if (notificationId) task.notificationId = notificationId;
      commitTasks([...tasksRef.current, task]);
      return task;
    },
    [commitTasks],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<TaskInput> & { done?: boolean }): Promise<Task | null> => {
      const existing = tasksRef.current.find((task) => task.id === id);
      if (!existing) return null;

      const next: Task = {
        ...existing,
        ...(patch.title !== undefined ? { title: patch.title.trim() } : null),
        ...(patch.notes !== undefined ? { notes: patch.notes.trim() || undefined } : null),
        ...('dueAt' in patch ? { dueAt: patch.dueAt } : null),
        ...('remindAt' in patch ? { remindAt: patch.remindAt } : null),
        ...(patch.priority !== undefined ? { priority: patch.priority } : null),
        ...(patch.done !== undefined
          ? { done: patch.done, completedAt: patch.done ? Date.now() : undefined }
          : null),
      };

      const reminderChanged = next.remindAt !== existing.remindAt || next.done !== existing.done;
      if (reminderChanged) {
        await cancelReminder(existing.notificationId);
        next.notificationId = undefined;
        if (!next.done) {
          const notificationId = await scheduleReminder(next);
          if (notificationId) next.notificationId = notificationId;
        }
      }

      commitTasks(tasksRef.current.map((task) => (task.id === id ? next : task)));
      return next;
    },
    [commitTasks],
  );

  const toggleTask = useCallback(
    async (id: string) => {
      const existing = tasksRef.current.find((task) => task.id === id);
      if (!existing) return null;
      return updateTask(id, { done: !existing.done });
    },
    [updateTask],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const existing = tasksRef.current.find((task) => task.id === id);
      if (existing?.notificationId) await cancelReminder(existing.notificationId);
      commitTasks(tasksRef.current.filter((task) => task.id !== id));
    },
    [commitTasks],
  );

  const addExpense = useCallback(
    async (input: ExpenseInput): Promise<Expense> => {
      const note = input.note?.trim() ?? '';
      const expense: Expense = {
        id: newId(),
        amount: Math.round(input.amount * 100) / 100,
        currency: input.currency ?? defaultCurrency,
        category: input.category ?? guessCategory(note),
        note,
        spentAt: input.spentAt ?? Date.now(),
        createdAt: Date.now(),
      };
      commitExpenses([...expensesRef.current, expense]);
      return expense;
    },
    [commitExpenses, defaultCurrency],
  );

  const updateExpense = useCallback(
    async (id: string, patch: Partial<ExpenseInput>): Promise<Expense | null> => {
      const existing = expensesRef.current.find((expense) => expense.id === id);
      if (!existing) return null;
      const next: Expense = {
        ...existing,
        ...(patch.amount !== undefined ? { amount: Math.round(patch.amount * 100) / 100 } : null),
        ...(patch.currency !== undefined ? { currency: patch.currency } : null),
        ...(patch.category !== undefined ? { category: patch.category } : null),
        ...(patch.note !== undefined ? { note: patch.note.trim() } : null),
        ...(patch.spentAt !== undefined ? { spentAt: patch.spentAt } : null),
      };
      commitExpenses(expensesRef.current.map((expense) => (expense.id === id ? next : expense)));
      return next;
    },
    [commitExpenses],
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      commitExpenses(expensesRef.current.filter((expense) => expense.id !== id));
    },
    [commitExpenses],
  );

  const clearEverything = useCallback(async () => {
    await Promise.all(tasksRef.current.map((task) => cancelReminder(task.notificationId)));
    tasksRef.current = [];
    expensesRef.current = [];
    setTasks([]);
    setExpenses([]);
    await clearStore();
  }, []);

  const value = useMemo<StoreApi>(
    () => ({
      ready,
      tasks,
      expenses,
      defaultCurrency,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      addExpense,
      updateExpense,
      deleteExpense,
      clearEverything,
    }),
    [
      ready,
      tasks,
      expenses,
      defaultCurrency,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      addExpense,
      updateExpense,
      deleteExpense,
      clearEverything,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
