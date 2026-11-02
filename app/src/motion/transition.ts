import { Platform, type ViewStyle } from 'react-native';

import { Motion } from '@/constants/theme';

/** A CSS transition for the named properties on web; nothing on phones, where Reanimated drives state changes. */
export function webTransition(properties: string, ms: number = Motion.fast + 40): ViewStyle | undefined {
  if (Platform.OS !== 'web') return undefined;
  return { transitionProperty: properties, transitionDuration: `${ms}ms`, transitionTimingFunction: Motion.ease } as unknown as ViewStyle;
}
