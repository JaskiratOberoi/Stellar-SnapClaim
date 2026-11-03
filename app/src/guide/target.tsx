import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useGuideTarget } from '@/guide/guide';

/**
 * Wraps a control a tour can point at. Rendered inside a Screen so it knows
 * how to scroll itself into view; `collapsable={false}` keeps the view real on
 * Android so it can be measured.
 */
export function GuideTarget({ id, children, style }: { id: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useGuideTarget(id);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
