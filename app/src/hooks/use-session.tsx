import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, clearSession, loadTokens, onSignedOut, storeSession } from '@/services/api';
import type { Category, Company, PolicyRule, Session, User } from '@/services/types';

type SessionState = {
  ready: boolean;
  user: User | null;
  company: Company | null;
  categories: Category[];
  policy: PolicyRule[];
  extractionEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (capability: string) => boolean;
};

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [policy, setPolicy] = useState<PolicyRule[]>([]);
  const [extractionEnabled, setExtractionEnabled] = useState(false);

  const loadReference = useCallback(async () => {
    const [cats, rules, caps] = await Promise.all([
      api<{ items: Category[] }>('/api/v1/categories'),
      api<{ items: PolicyRule[] }>('/api/v1/policy'),
      api<{ extraction_enabled: boolean }>('/api/v1/receipts/capabilities'),
    ]);
    setCategories(cats.items);
    setPolicy(rules.items);
    setExtractionEnabled(caps.extraction_enabled);
  }, []);

  const refresh = useCallback(async () => {
    const me = await api<{ user: User; company: Company }>('/api/v1/auth/me');
    setUser(me.user);
    setCompany(me.company);
    await loadReference();
  }, [loadReference]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await loadTokens()) await refresh();
      } catch {
        // token expired or server unreachable: start signed out
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    const off = onSignedOut(() => {
      setUser(null);
      setCompany(null);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await api<Session>('/api/v1/auth/login', { body: { email, password }, auth: false });
      await storeSession(session);
      setUser(session.user);
      setCompany(session.company);
      await loadReference();
    },
    [loadReference],
  );

  const signOut = useCallback(async () => {
    await clearSession();
    setUser(null);
    setCompany(null);
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      user,
      company,
      categories,
      policy,
      extractionEnabled,
      signIn,
      signOut,
      refresh,
      can: (capability) => user?.capabilities.includes(capability) ?? false,
    }),
    [ready, user, company, categories, policy, extractionEnabled, signIn, signOut, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
