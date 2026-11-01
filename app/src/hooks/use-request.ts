import { useCallback, useEffect, useState } from 'react';

import { describeError } from '@/services/api';

type State<T> = { data: T | null; error: string | null; loading: boolean };

/**
 * Small data-loading hook: runs `load` on mount and whenever `deps` change,
 * exposes the result, the error text and a `reload`.
 */
export function useRequest<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // The loading flag flips in a microtask so the effect body itself sets no state.
    Promise.resolve()
      .then(() => {
        if (!cancelled) setState((s) => (s.loading ? s : { ...s, loading: true }));
        return load();
      })
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ ...s, error: describeError(err), loading: false }));
      });
    return () => {
      cancelled = true;
    };
    // `load` is an inline closure; it is re-captured whenever deps or tick change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T | null) => setState((s) => ({ ...s, data })), []);
  return { data: state.data, error: state.error, loading: state.loading, reload, setData };
}
