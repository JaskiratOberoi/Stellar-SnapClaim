/**
 * Domain types for everything the assistant stores: tasks (which double as
 * reminders when they carry a remind time) and expenses.
 */

export type Priority = 'low' | 'normal' | 'high';

export type Task = {
  id: string;
  title: string;
  notes?: string;
  /** When the task is due, epoch ms. */
  dueAt?: number;
  /** When to notify, epoch ms. A task with this set is a reminder. */
  remindAt?: number;
  /** Identifier of the scheduled local notification, if one exists. */
  notificationId?: string;
  priority: Priority;
  done: boolean;
  createdAt: number;
  completedAt?: number;
};

export type TaskInput = {
  title: string;
  notes?: string;
  dueAt?: number;
  remindAt?: number;
  priority?: Priority;
};

export type ExpenseCategory =
  | 'food'
  | 'groceries'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'health'
  | 'entertainment'
  | 'travel'
  | 'home'
  | 'other';

export type CategoryInfo = {
  id: ExpenseCategory;
  label: string;
  /** Words in a note that suggest this category. */
  keywords: string[];
  /** Material symbol / SF symbol names for the category chip. */
  icon: { ios: string; material: string };
};

export const EXPENSE_CATEGORIES: CategoryInfo[] = [
  {
    id: 'food',
    label: 'Food & drink',
    keywords: ['lunch', 'dinner', 'breakfast', 'coffee', 'tea', 'snack', 'restaurant', 'food', 'pizza', 'burger', 'zomato', 'swiggy', 'chai', 'meal'],
    icon: { ios: 'fork.knife', material: 'restaurant' },
  },
  {
    id: 'groceries',
    label: 'Groceries',
    keywords: ['grocery', 'groceries', 'vegetables', 'milk', 'supermarket', 'bigbasket', 'blinkit', 'zepto', 'fruits'],
    icon: { ios: 'cart.fill', material: 'shopping_cart' },
  },
  {
    id: 'transport',
    label: 'Transport',
    keywords: ['uber', 'ola', 'taxi', 'cab', 'auto', 'fuel', 'petrol', 'diesel', 'metro', 'bus', 'train', 'parking', 'toll', 'rapido'],
    icon: { ios: 'car.fill', material: 'directions_car' },
  },
  {
    id: 'shopping',
    label: 'Shopping',
    keywords: ['amazon', 'flipkart', 'clothes', 'shoes', 'shopping', 'myntra', 'gift', 'electronics'],
    icon: { ios: 'bag.fill', material: 'shopping_bag' },
  },
  {
    id: 'bills',
    label: 'Bills & utilities',
    keywords: ['bill', 'electricity', 'water', 'internet', 'wifi', 'phone', 'recharge', 'rent', 'subscription', 'netflix', 'emi', 'insurance', 'gas'],
    icon: { ios: 'doc.text.fill', material: 'receipt_long' },
  },
  {
    id: 'health',
    label: 'Health',
    keywords: ['doctor', 'medicine', 'pharmacy', 'chemist', 'hospital', 'gym', 'clinic', 'dentist', 'lab'],
    icon: { ios: 'heart.fill', material: 'favorite' },
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    keywords: ['movie', 'cinema', 'concert', 'game', 'spotify', 'tickets', 'show', 'bookmyshow'],
    icon: { ios: 'film.fill', material: 'movie' },
  },
  {
    id: 'travel',
    label: 'Travel',
    keywords: ['flight', 'hotel', 'trip', 'airbnb', 'visa', 'holiday', 'vacation', 'booking'],
    icon: { ios: 'airplane', material: 'flight' },
  },
  {
    id: 'home',
    label: 'Home',
    keywords: ['furniture', 'repair', 'plumber', 'electrician', 'maid', 'cleaning', 'household'],
    icon: { ios: 'house.fill', material: 'home' },
  },
  {
    id: 'other',
    label: 'Other',
    keywords: [],
    icon: { ios: 'ellipsis.circle.fill', material: 'more_horiz' },
  },
];

export function categoryInfo(id: ExpenseCategory): CategoryInfo {
  return EXPENSE_CATEGORIES.find((category) => category.id === id) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

/** Guess a category from free text such as "lunch with Ravi". */
export function guessCategory(text: string): ExpenseCategory {
  const words = text.toLowerCase();
  for (const category of EXPENSE_CATEGORIES) {
    if (category.keywords.some((keyword) => words.includes(keyword))) return category.id;
  }
  return 'other';
}

export type Expense = {
  id: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  note: string;
  /** When the money was spent, epoch ms. */
  spentAt: number;
  createdAt: number;
};

export type ExpenseInput = {
  amount: number;
  currency?: string;
  category?: ExpenseCategory;
  note?: string;
  spentAt?: number;
};
