import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Tap } from '@/motion/tap';
import { webTransition } from '@/motion/transition';

/** The slice of the navigator's tab bar props the rail needs; the rest is left to the library. */
type RailProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => ReactNode } }>;
  navigateToTab: (routeKey: string) => void;
};

/** The wide-window nav: a floating card at the top left, one pill per tab, the current one in plum. */
export function RailBar({ state, descriptors, navigateToTab }: RailProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.rail, { backgroundColor: theme.surfaceRaised, shadowColor: theme.shadow, marginTop: insets.top + Spacing.three }]}>
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const focused = state.index === i;
        const color = focused ? theme.textOnAccent : theme.textSecondary;
        const onPress = () => {
          if (!focused) navigateToTab(route.key);
        };
        return (
          <Tap
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.title ?? route.name}
            scale={0.94}
            onPress={onPress}
            style={({ pressed }) => [styles.item, { backgroundColor: focused ? theme.accent : pressed ? theme.backgroundElement : 'transparent' }, webTransition('background-color')]}>
            {options.tabBarIcon ? options.tabBarIcon({ focused, color, size: 22 }) : null}
            <ThemedText type="small" style={{ color, fontSize: 11, lineHeight: 14, fontWeight: 600 }} numberOfLines={1}>
              {options.title ?? route.name}
            </ThemedText>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    alignSelf: 'flex-start',
    marginLeft: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.one,
    borderRadius: Radius.large,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  item: { width: 96, paddingVertical: Spacing.two + Spacing.half, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
});
