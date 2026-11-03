import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type EnterFrom = 'up' | 'right';

/** The native stack already animates the screen in; the content itself stays still. */
export function PageEnter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle>; from?: EnterFrom }) {
  return <View style={style}>{children}</View>;
}
