import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Platform, type View } from 'react-native';

import { clearSeen, loadSeen, saveSeen, type Seen } from '@/guide/store';
import { useSession } from '@/hooks/use-session';

export type ViewHandle = ComponentRef<typeof View>;

/** A rectangle in window coordinates. */
export type Rect = { x: number; y: number; width: number; height: number };

export type Step = {
  /** The registered control the step points at; omit for a centred card. */
  target?: string;
  title: string;
  body: string;
  /** A spot illustration for a centred card. */
  art?: 'welcome' | 'lifecycle' | 'inbox' | 'ledger';
  /** The last step's primary button can take the person somewhere. */
  action?: { label: string; onPress: () => void };
};

type Tour = { id: string; steps: Step[] };

type Target = { ref: RefObject<ViewHandle | null>; scroll: ScrollHandle | null };
export type ScrollHandle = { scrollBy: (dy: number) => void };

type Guide = {
  /** Flags are loaded for the signed-in user. */
  ready: boolean;
  seen: (id: string) => boolean;
  markSeen: (id: string) => void;
  /** Forget everything seen, so every tour and hint shows again. */
  reset: () => Promise<void>;
  /** Start a tour now, whether or not it was seen. */
  start: (tour: Tour) => void;
  /** Start a tour once: the first time this user lands on the screen. */
  offer: (tour: Tour) => void;
  active: Tour | null;
  index: number;
  next: () => void;
  back: () => void;
  skip: () => void;
  register: (id: string, target: Target) => () => void;
  measure: (id: string) => Promise<Rect | null>;
  scrollTargetBy: (id: string, dy: number) => boolean;
};

const Ctx = createContext<Guide | null>(null);
export const ScrollCtx = createContext<ScrollHandle | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [seenState, setSeenState] = useState<{ userId: string | null; seen: Seen } | null>(null);
  const [activeTour, setActive] = useState<Tour | null>(null);
  // A tour belongs to the person who started it; signing out ends it.
  const active = userId ? activeTour : null;
  const [index, setIndex] = useState(0);
  const targets = useRef(new Map<string, Target>());

  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    loadSeen(userId).then((seen) => {
      if (!cancelled) setSeenState({ userId, seen });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ready = seenState !== null && seenState.userId === userId;
  const seen = useCallback((id: string) => ready && !!seenState?.seen[id], [ready, seenState]);

  const markSeen = useCallback(
    (id: string) => {
      if (!userId) return;
      setSeenState((s) => {
        if (!s || s.userId !== userId || s.seen[id]) return s;
        const seen = { ...s.seen, [id]: true as const };
        saveSeen(userId, seen);
        return { userId, seen };
      });
    },
    [userId],
  );

  const reset = useCallback(async () => {
    if (!userId) return;
    await clearSeen(userId);
    setSeenState({ userId, seen: {} });
  }, [userId]);

  const start = useCallback((tour: Tour) => {
    setActive(tour);
    setIndex(0);
  }, []);

  const offer = useCallback(
    (tour: Tour) => {
      if (!ready || seen(tour.id) || active) return;
      start(tour);
    },
    [ready, seen, active, start],
  );

  const finish = useCallback(() => {
    setActive((t) => {
      if (t) markSeen(t.id);
      return null;
    });
    setIndex(0);
  }, [markSeen]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (!active || i + 1 >= active.steps.length) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [active, finish]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const register = useCallback((id: string, target: Target) => {
    targets.current.set(id, target);
    return () => {
      if (targets.current.get(id) === target) targets.current.delete(id);
    };
  }, []);

  const measure = useCallback((id: string) => {
    const t = targets.current.get(id);
    const node = t?.ref.current;
    if (!node) return Promise.resolve<Rect | null>(null);
    return new Promise<Rect | null>((resolve) => {
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        if (!Number.isFinite(x) || width === 0) resolve(null);
        else resolve({ x, y, width, height });
      });
    });
  }, []);

  const scrollTargetBy = useCallback((id: string, dy: number) => {
    const t = targets.current.get(id);
    if (!t?.scroll) return false;
    t.scroll.scrollBy(dy);
    return true;
  }, []);

  // Escape skips, on the web.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish]);

  const value = useMemo<Guide>(
    () => ({ ready, seen, markSeen, reset, start, offer, active, index, next, back, skip: finish, register, measure, scrollTargetBy }),
    [ready, seen, markSeen, reset, start, offer, active, index, next, back, finish, register, measure, scrollTargetBy],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGuide(): Guide {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGuide must be used inside GuideProvider');
  return ctx;
}

/**
 * Marks a view as something a tour can point at. Attach the returned ref to a
 * View (it needs `collapsable={false}` on Android to stay measurable).
 */
export function useGuideTarget(id: string): RefObject<ViewHandle | null> {
  const { register } = useGuide();
  const scroll = useContext(ScrollCtx);
  const ref = useRef<ViewHandle | null>(null);
  useEffect(() => register(id, { ref, scroll }), [id, register, scroll]);
  return ref;
}

/** Run a tour the first time this user lands here, once the screen has settled. */
export function useTourOnce(tour: Tour | null, when: boolean, delay = 700) {
  const { offer, ready, seen } = useGuide();
  const offered = useRef(false);
  useEffect(() => {
    if (!tour || !when || !ready || offered.current || seen(tour.id)) return;
    offered.current = true;
    const t = setTimeout(() => offer(tour), delay);
    return () => clearTimeout(t);
  }, [tour, when, ready, seen, offer, delay]);
}
