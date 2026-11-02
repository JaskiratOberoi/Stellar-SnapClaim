import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

import { Motion } from '@/constants/theme';

export type TapProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  outerStyle?: StyleProp<ViewStyle>;
  scale?: number;
  children?: ReactNode;
};

/** CSS transitions carry the press on web: transform and background settle in 160 ms on the theme curve. */
export function Tap({ style, outerStyle, scale = 0.97, children, ...rest }: TapProps) {
  return (
    <Pressable {...rest} style={outerStyle}>
      {(state) => (
        <View
          style={[
            typeof style === 'function' ? style(state) : style,
            { transform: [{ scale: state.pressed ? scale : 1 }] },
            transition,
          ]}>
          {children}
        </View>
      )}
    </Pressable>
  );
}

const transition = {
  transitionProperty: 'transform, background-color, opacity',
  transitionDuration: `${Motion.fast + 40}ms`,
  transitionTimingFunction: Motion.ease,
} as unknown as ViewStyle;
