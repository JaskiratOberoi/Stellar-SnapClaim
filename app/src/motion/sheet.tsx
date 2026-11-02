import type { ReactNode } from 'react';

/** On phones the native stack presents the route as a modal, so the route renders as itself. */
export function Sheet({ children }: { children: ReactNode }) {
  return children;
}
