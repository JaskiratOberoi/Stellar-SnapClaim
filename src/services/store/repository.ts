/**
 * Persistence for the store. Everything lives in AsyncStorage as JSON, which
 * works identically on Android, iOS, web and the Electron shell.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Expense, Task } from './types';

const TASKS_KEY = 'assistant.tasks.v1';
const EXPENSES_KEY = 'assistant.expenses.v1';

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function loadTasks(): Promise<Task[]> {
  return readList<Task>(TASKS_KEY);
}

export function saveTasks(tasks: Task[]): Promise<void> {
  return AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export function loadExpenses(): Promise<Expense[]> {
  return readList<Expense>(EXPENSES_KEY);
}

export function saveExpenses(expenses: Expense[]): Promise<void> {
  return AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

export async function clearStore(): Promise<void> {
  await AsyncStorage.multiRemove([TASKS_KEY, EXPENSES_KEY]);
}
