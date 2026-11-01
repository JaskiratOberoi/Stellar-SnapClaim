import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribe = () => () => {};

/**
 * Static web rendering has no window: render light on the server and the
 * real scheme once hydrated, without a setState-in-effect.
 */
export function useColorScheme() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const scheme = useRNColorScheme();
  return hydrated ? scheme : 'light';
}
